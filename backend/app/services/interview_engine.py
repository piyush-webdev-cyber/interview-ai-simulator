from uuid import uuid4

from fastapi import HTTPException

from app.models.session import InterviewRound, InterviewState, ROUND_ORDER
from app.schemas.interview import (
    AnswerReview,
    FinalReport,
    HistoryItem,
    InterviewSession,
    ProgressSummary,
    RoundFeedback,
    StartInterviewRequest,
    VoiceMetrics,
)
from app.services.ai_service import AIService


class InterviewEngine:
    def __init__(self, ai_service: AIService) -> None:
        self.ai_service = ai_service
        self.sessions: dict[str, InterviewSession] = {}
        self.completed_reports: dict[str, FinalReport] = {}

    async def start(self, payload: StartInterviewRequest) -> InterviewSession:
        raw_role = payload.role.strip()
        role = self._normalize_role(raw_role)
        difficulty = self._normalize_difficulty(payload.difficulty)
        print("Received role:", raw_role, "Normalized role:", role)
        if len(role) < 2:
            raise HTTPException(status_code=400, detail="Please enter a valid role")

        session_id = str(uuid4())
        total_questions = self._mode_total_questions(payload.mode)
        first_round = self._round_for_mode(payload.mode, 0)
        weak_areas = self._weak_areas_for_role(role)
        first_topic = weak_areas[0] if weak_areas else None
        question = await self.ai_service.generate_question(
            role,
            difficulty,
            first_round,
            payload.mode,
            [],
            weak_areas=weak_areas,
            topic=first_topic,
            question_index=1,
            total_questions=total_questions,
        )
        session = InterviewSession(
            id=session_id,
            role=role,
            difficulty=difficulty,
            mode=payload.mode,
            total_questions=total_questions,
            current_round=first_round,
            current_question=question,
        )
        self.sessions[session_id] = session
        return session

    async def submit_answer(self, session_id: str, answer: str, voice_metrics: VoiceMetrics | None = None) -> tuple[InterviewSession, RoundFeedback, bool]:
        session = self._get_session(session_id)
        if session.state == InterviewState.COMPLETED:
            raise HTTPException(status_code=409, detail="Interview session is already completed")

        feedback = await self.ai_service.evaluate_answer(
            session.role,
            session.mode,
            session.current_round,
            session.current_question,
            answer,
            list(session.scores.values()),
            voice_metrics,
            history=session.history,
            weak_areas=self._practice_weak_areas(session),
            topic=self._current_practice_topic(session),
        )
        session.history.append(
            HistoryItem(
                round=session.current_round,
                question=session.current_question,
                answer=answer,
                feedback=feedback,
            )
        )
        session.scores[session.current_round.value] = feedback.score

        if session.mode != "Mock Interview":
            if len(session.history) >= session.total_questions:
                session.state = InterviewState.COMPLETED
                session.current_round = InterviewRound.FEEDBACK
                session.current_question = "Interview complete. Review your feedback report."
                self.completed_reports[session.id] = await self.ai_service.create_report(session.id, session.role, session.history)
                return session, feedback, True

            next_index = len(session.history)
            next_round = self._round_for_mode(session.mode, next_index)
            session.current_round = next_round
            next_weak_areas = self._practice_weak_areas(session)
            next_topic = feedback.next_focus_area or self._current_practice_topic(session)
            next_question = await self.ai_service.generate_question(
                session.role,
                session.difficulty,
                next_round,
                session.mode,
                session.history,
                weak_areas=next_weak_areas,
                topic=next_topic,
                question_index=next_index + 1,
                total_questions=session.total_questions,
            )
            session.current_question = next_question
            if session.mode == "Rapid Fire Mode":
                feedback.progress = f"{len(session.history)}/{session.total_questions}"
                feedback.next_question = next_question
            return session, feedback, False

        if len(session.history) >= session.total_questions or self._is_last_round(session.current_round):
            session.state = InterviewState.COMPLETED
            session.current_round = InterviewRound.FEEDBACK
            session.current_question = "Interview complete. Review your feedback report."
            self.completed_reports[session.id] = await self.ai_service.create_report(session.id, session.role, session.history)
            return session, feedback, True

        next_round = self._next_round(session.current_round)
        session.current_round = next_round
        session.current_question = await self.ai_service.generate_question(
            session.role,
            session.difficulty,
            next_round,
            session.mode,
            session.history,
            weak_areas=self._practice_weak_areas(session),
            topic=self._current_practice_topic(session),
            question_index=len(session.history) + 1,
            total_questions=session.total_questions,
        )
        return session, feedback, False

    async def next_question(self, session_id: str) -> InterviewSession:
        return self._get_session(session_id)

    async def feedback(self, session_id: str) -> FinalReport:
        session = self._get_session(session_id)
        if session.state != InterviewState.COMPLETED:
            raise HTTPException(status_code=409, detail="Feedback is available after the interview is completed")
        if session_id not in self.completed_reports:
            self.completed_reports[session_id] = await self.ai_service.create_report(session.id, session.role, session.history)
        return self.completed_reports[session_id]

    def progress(self) -> ProgressSummary:
        difficulty_order = ["Beginner", "Intermediate", "Senior"]
        mode_order = ["Practice Mode", "Mock Interview", "Rapid Fire Mode"]
        completed = [session for session in self.sessions.values() if session.state == InterviewState.COMPLETED]
        reports = [self.completed_reports[session.id] for session in completed if session.id in self.completed_reports]
        average = round(sum(report.overall_score for report in reports) / len(reports), 1) if reports else 0
        weak_topics = sorted({topic for report in reports for topic in report.weak_topics})[:6]
        phase_status: dict[str, dict[str, bool]] = {
            difficulty: {mode: False for mode in mode_order}
            for difficulty in difficulty_order
        }
        for session in completed:
            report = self.completed_reports.get(session.id)
            if not report:
                continue
            difficulty = self._normalize_difficulty(session.difficulty)
            if difficulty in phase_status and session.mode in phase_status[difficulty] and report.overall_score >= 7:
                phase_status[difficulty][session.mode] = True

        difficulty_unlocks = {
            "Beginner": True,
            "Intermediate": all(phase_status["Beginner"][mode] for mode in mode_order),
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

        recent_answer_reviews = self._recent_answer_reviews(completed)
        return ProgressSummary(
            total_interviews=len(completed),
            average_score=average,
            mode_unlocks={
                "Practice Mode": True,
                "Mock Interview": mock_unlocked,
                "Rapid Fire Mode": rapid_fire_unlocked,
            },
            recommended_next_mode=recommended_next_mode,
            difficulty_unlocks=difficulty_unlocks,
            recommended_difficulty=recommended_difficulty,
            difficulty_phase_status=phase_status,
            score_trends=[
                {"session_id": report.session_id, "role": report.role, "score": report.overall_score}
                for report in reports[-8:]
            ],
            weak_topics=weak_topics,
            recent_answer_reviews=recent_answer_reviews,
            recent_sessions=completed[-5:],
        )

    def _get_session(self, session_id: str) -> InterviewSession:
        session = self.sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Interview session not found")
        return session

    def _is_last_round(self, round_name: InterviewRound) -> bool:
        return round_name == ROUND_ORDER[-1]

    def _next_round(self, round_name: InterviewRound) -> InterviewRound:
        current_index = ROUND_ORDER.index(round_name)
        return ROUND_ORDER[current_index + 1]

    def _mode_total_questions(self, mode: str) -> int:
        if mode == "Practice Mode":
            return 5
        if mode == "Rapid Fire Mode":
            return 10
        return len(ROUND_ORDER)

    def _round_for_mode(self, mode: str, index: int) -> InterviewRound:
        if mode == "Practice Mode":
            return InterviewRound.DOMAIN
        if mode == "Rapid Fire Mode":
            return InterviewRound.FINAL
        return ROUND_ORDER[min(index, len(ROUND_ORDER) - 1)]

    def _normalize_role(self, role: str) -> str:
        normalized = " ".join(role.split())
        abbreviations = {
            "dsa": "Data Structures and Algorithms",
            "sde": "Software Development Engineer",
            "fe": "Frontend Developer",
        }
        return abbreviations.get(normalized.casefold(), normalized)

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

    def _weak_areas_for_role(self, role: str) -> list[str]:
        role_key = role.casefold()
        role_reports = [
            report for report in self.completed_reports.values()
            if report.role.casefold() == role_key and report.weak_topics
        ]
        if role_reports:
            seen: set[str] = set()
            ordered: list[str] = []
            for report in reversed(role_reports):
                for topic in report.weak_topics:
                    cleaned = topic.strip()
                    key = cleaned.casefold()
                    if cleaned and key not in seen:
                        seen.add(key)
                        ordered.append(cleaned)
            if ordered:
                return ordered[:5]

        generic_topics = {"role fundamentals", "communication clarity"}
        global_progress = self.progress()
        filtered_global_topics = [
            topic for topic in global_progress.weak_topics
            if topic.strip().casefold() not in generic_topics
        ]
        if filtered_global_topics:
            return filtered_global_topics[:5]
        return self._default_practice_topics_for_role(role)

    def _default_practice_topics_for_role(self, role: str) -> list[str]:
        role_key = role.casefold()
        if any(token in role_key for token in ["full stack", "fullstack"]):
            return ["API design", "database modeling", "React state management", "authentication flow", "production debugging"]
        if any(token in role_key for token in ["frontend", "front end", "react", "web developer"]):
            return ["component design", "state management", "accessibility", "API integration", "responsive layout"]
        if any(token in role_key for token in ["backend", "api", "server"]):
            return ["API contract design", "database query performance", "authorization", "background jobs", "observability"]
        if any(token in role_key for token in ["software", "sde", "developer", "engineer"]):
            return ["system design basics", "debugging", "refactoring", "data modeling", "testing edge cases"]
        if any(token in role_key for token in ["data analyst", "business analyst", "analyst"]):
            return ["KPI definition", "root-cause analysis", "SQL analysis", "data quality", "stakeholder communication"]
        if any(token in role_key for token in ["data scientist", "machine learning", "ml", "ai"]):
            return ["model evaluation", "data preprocessing", "production drift", "business trade-offs", "experiment design"]
        if any(token in role_key for token in ["devops", "cloud", "site reliability", "sre"]):
            return ["CI/CD", "rollback strategy", "monitoring", "incident diagnosis", "secret management"]
        if any(token in role_key for token in ["product manager", "product owner"]):
            return ["prioritization", "success metrics", "customer discovery", "roadmap trade-offs", "stakeholder alignment"]
        if any(token in role_key for token in ["ux", "ui", "designer", "researcher"]):
            return ["user research", "mobile usability", "information architecture", "design handoff", "accessibility"]
        if any(token in role_key for token in ["qa", "quality assurance", "tester"]):
            return ["test planning", "regression coverage", "bug reproduction", "automation strategy", "API validation"]
        if any(token in role_key for token in ["mobile", "android", "ios", "react native"]):
            return ["platform debugging", "offline handling", "list performance", "native permissions", "API connectivity"]
        if any(token in role_key for token in ["cyber", "security"]):
            return ["suspicious login investigation", "authorization bypass", "risk communication", "secret protection", "input validation"]
        return ["practical execution", "problem diagnosis", "quality trade-offs", "success metrics", "clear communication"]

    def _practice_weak_areas(self, session: InterviewSession) -> list[str]:
        seen: set[str] = set()
        ordered: list[str] = []
        for topic in self._weak_areas_for_role(session.role):
            key = topic.casefold()
            if key not in seen:
                seen.add(key)
                ordered.append(topic)
        for item in session.history:
            if item.feedback:
                for topic in item.feedback.missing_points + item.feedback.weaknesses:
                    cleaned = topic.strip()
                    key = cleaned.casefold()
                    if cleaned and key not in seen:
                        seen.add(key)
                        ordered.append(cleaned)
                if item.feedback.next_focus_area:
                    cleaned = item.feedback.next_focus_area.strip()
                    key = cleaned.casefold()
                    if cleaned and key not in seen:
                        seen.add(key)
                        ordered.insert(0, cleaned)
        return ordered[:6]

    def _current_practice_topic(self, session: InterviewSession) -> str | None:
        if session.history and session.history[-1].feedback and session.history[-1].feedback.next_focus_area:
            return session.history[-1].feedback.next_focus_area
        weak_areas = self._practice_weak_areas(session)
        return weak_areas[0] if weak_areas else None

    def _recent_answer_reviews(self, completed: list[InterviewSession]) -> list[AnswerReview]:
        reviews: list[AnswerReview] = []
        for session in reversed(completed):
            for item in reversed(session.history):
                if not item.feedback or not item.answer:
                    continue
                reviews.append(
                    AnswerReview(
                        role=session.role,
                        mode=session.mode,
                        difficulty=self._normalize_difficulty(session.difficulty),
                        question=item.question,
                        answer=item.answer,
                        score=item.feedback.score,
                        verdict=item.feedback.verdict,
                        feedback=item.feedback.final_feedback,
                        weaknesses=item.feedback.weaknesses[:2],
                    )
                )
                if len(reviews) >= 8:
                    return reviews
        return reviews
