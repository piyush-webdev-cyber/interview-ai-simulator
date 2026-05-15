from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import AuthUser
from app.models.session import InterviewState
from app.repositories.interviews import InterviewRepository
from app.repositories.users import UserRepository
from app.schemas.interview import (
    FinalReport,
    InterviewSession,
    ProgressSummary,
    RoundFeedback,
    StartInterviewRequest,
    VoiceMetrics,
)
from app.services.ai_service import AIService
from app.services.interview_engine import InterviewEngine


class InterviewAppService:
    def __init__(self, db: AsyncSession, ai_service: AIService, engine: InterviewEngine) -> None:
        self.db = db
        self.ai_service = ai_service
        self.engine = engine
        self.users = UserRepository(db)
        self.interviews = InterviewRepository(db)

    async def start_interview(self, user: AuthUser, payload: StartInterviewRequest) -> InterviewSession:
        await self.users.ensure_user(user)
        session = await self.engine.start(payload)
        await self.interviews.create_session(user.id, session)
        await self.db.commit()
        return session

    async def get_session(self, user: AuthUser, session_id: str) -> InterviewSession:
        record = await self.interviews.get_session(session_id, user.id)
        if not record:
            fallback = self.engine.sessions.get(session_id)
            if fallback:
                return fallback
            raise NotFoundError("Interview session not found")
        return self.interviews.to_schema(record)

    async def submit_answer(
        self,
        user: AuthUser,
        session_id: str,
        answer: str,
        voice_metrics: VoiceMetrics | None = None,
    ) -> tuple[InterviewSession, RoundFeedback, bool]:
        record = await self.interviews.get_session(session_id, user.id)

        if record:
            session_schema = self.interviews.to_schema(record)
            self.engine.sessions[session_id] = session_schema

        session, feedback, is_completed = await self.engine.submit_answer(session_id, answer, voice_metrics)

        if not record:
            await self.db.rollback()
            return session, feedback, is_completed

        previous_item = session.history[-1]
        await self.interviews.save_answer(record, previous_item.round, previous_item.question, answer, feedback)
        await self.interviews.update_session(record, session)

        if is_completed:
            report = await self.engine.feedback(session_id)
            await self.interviews.save_report(report)

        await self.db.commit()
        return session, feedback, is_completed

    async def get_feedback(self, user: AuthUser, session_id: str) -> FinalReport:
        record = await self.interviews.get_session(session_id, user.id)
        if record and record.report:
            return self.interviews.report_to_schema(record.report, record.role)

        if record and not record.report:
            session_schema = self.interviews.to_schema(record)
            if session_schema.state != InterviewState.COMPLETED:
                raise ConflictError("Feedback is available after the interview is completed")
            report = await self.ai_service.create_report(record.id, record.role, session_schema.history)
            await self.interviews.save_report(report)
            await self.db.commit()
            return report

        return await self.engine.feedback(session_id)

    async def get_progress(self, user: AuthUser) -> ProgressSummary:
        records = await self.interviews.list_completed(user.id)
        if not records:
            return self.engine.progress()

        reports = [record.report for record in records if record.report]
        average = round(sum(report.overall_score for report in reports) / len(reports), 1) if reports else 0
        weak_topics = sorted({topic for report in reports for topic in report.weak_topics})[:6]
        difficulty_order = ["Beginner", "Intermediate", "Senior"]
        mode_order = ["Practice Mode", "Mock Interview", "Rapid Fire Mode"]
        phase_status: dict[str, dict[str, bool]] = {
            difficulty: {mode: False for mode in mode_order}
            for difficulty in difficulty_order
        }
        role_phase_status: dict[str, dict[str, dict[str, bool]]] = {}

        for record in records:
            if not record.report or record.report.overall_score < 7:
                continue
            difficulty = self._normalize_difficulty(record.difficulty)
            if difficulty in phase_status and record.mode in phase_status[difficulty]:
                phase_status[difficulty][record.mode] = True
            role_key = self._role_progress_key(record.role)
            if difficulty in difficulty_order and record.mode in mode_order:
                role_phase_status.setdefault(
                    role_key,
                    {item: {mode: False for mode in mode_order} for item in difficulty_order},
                )
                role_phase_status[role_key][difficulty][record.mode] = True

        difficulty_unlocks = {
            "Beginner": True,
            "Intermediate": all(phase_status["Beginner"][mode] for mode in mode_order),
            "Mid-level": all(phase_status["Beginner"][mode] for mode in mode_order),
            "Senior": all(phase_status["Intermediate"][mode] for mode in mode_order),
        }
        if difficulty_unlocks["Senior"]:
            recommended_difficulty = "Senior"
        elif difficulty_unlocks["Intermediate"]:
            recommended_difficulty = "Intermediate"
        else:
            recommended_difficulty = "Beginner"

        current_phase_status = phase_status[recommended_difficulty]
        mock_unlocked = current_phase_status["Practice Mode"]
        rapid_fire_unlocked = current_phase_status["Mock Interview"]
        recommended_next_mode = "Practice Mode"
        if mock_unlocked and not rapid_fire_unlocked:
            recommended_next_mode = "Mock Interview"
        elif rapid_fire_unlocked and not current_phase_status["Rapid Fire Mode"]:
            recommended_next_mode = "Rapid Fire Mode"

        return ProgressSummary(
            total_interviews=len(records),
            average_score=average,
            mode_unlocks={
                "Practice Mode": True,
                "Mock Interview": mock_unlocked,
                "Rapid Fire Mode": rapid_fire_unlocked,
            },
            recommended_next_mode=recommended_next_mode,
            score_trends=[
                {
                    "session_id": report.session_id,
                    "role": next(record.role for record in records if record.id == report.session_id),
                    "score": report.overall_score,
                }
                for report in reports[-8:]
            ],
            difficulty_unlocks=difficulty_unlocks,
            recommended_difficulty=recommended_difficulty,
            difficulty_phase_status=phase_status,
            role_phase_status=role_phase_status,
            weak_topics=weak_topics,
            recent_answer_reviews=[],
            recent_sessions=[self.interviews.to_schema(record) for record in records[:5]],
        )

    def _normalize_difficulty(self, difficulty: str) -> str:
        normalized = " ".join(difficulty.split()).casefold()
        mapping = {
            "beginner": "Beginner",
            "intermediate": "Intermediate",
            "mid-level": "Intermediate",
            "mid level": "Intermediate",
            "senior": "Senior",
        }
        return mapping.get(normalized, difficulty.strip().title() or "Beginner")

    def _role_progress_key(self, role: str) -> str:
        return "".join(character for character in role.casefold() if character.isalnum())
