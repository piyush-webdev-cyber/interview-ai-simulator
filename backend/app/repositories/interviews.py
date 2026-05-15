from datetime import datetime, timezone

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.db import FeedbackReportRecord, InterviewAnswerRecord, InterviewSessionRecord
from app.models.session import InterviewRound, InterviewState
from app.schemas.interview import FinalReport, HistoryItem, InterviewSession, RoundFeedback


class InterviewRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_session(self, user_id: str, interview: InterviewSession) -> InterviewSessionRecord:
        record = InterviewSessionRecord(
            id=interview.id,
            user_id=user_id,
            role=interview.role,
            difficulty=interview.difficulty,
            mode=interview.mode,
            current_round=interview.current_round.value,
            current_question=interview.current_question,
            scores=interview.scores,
            state=interview.state.value,
        )
        self.session.add(record)
        await self.session.flush()
        return record

    async def get_session(self, session_id: str, user_id: str) -> InterviewSessionRecord | None:
        statement = self._base_session_query().where(
            InterviewSessionRecord.id == session_id,
            InterviewSessionRecord.user_id == user_id,
        )
        return await self.session.scalar(statement)

    async def list_completed(self, user_id: str, limit: int = 20) -> list[InterviewSessionRecord]:
        statement = (
            self._base_session_query()
            .where(
                InterviewSessionRecord.user_id == user_id,
                InterviewSessionRecord.state == InterviewState.COMPLETED.value,
            )
            .order_by(InterviewSessionRecord.completed_at.desc().nullslast(), InterviewSessionRecord.created_at.desc())
            .limit(limit)
        )
        result = await self.session.scalars(statement)
        return list(result)

    async def save_answer(
        self,
        record: InterviewSessionRecord,
        round_name: InterviewRound,
        question: str,
        answer: str,
        feedback: RoundFeedback,
    ) -> InterviewAnswerRecord:
        answer_record = InterviewAnswerRecord(
            session_id=record.id,
            round=round_name.value,
            question=question,
            answer=answer,
            score=feedback.score,
            strengths=feedback.strengths,
            weaknesses=feedback.weaknesses,
            follow_up_question=feedback.follow_up_question,
        )
        self.session.add(answer_record)
        await self.session.flush()
        return answer_record

    async def update_session(self, record: InterviewSessionRecord, interview: InterviewSession) -> InterviewSessionRecord:
        record.current_round = interview.current_round.value
        record.current_question = interview.current_question
        record.scores = interview.scores
        record.state = interview.state.value
        if interview.state == InterviewState.COMPLETED and record.completed_at is None:
            record.completed_at = datetime.now(timezone.utc)
        await self.session.flush()
        return record

    async def save_report(self, report: FinalReport) -> FeedbackReportRecord:
        record = FeedbackReportRecord(
            session_id=report.session_id,
            overall_score=report.overall_score,
            category_breakdown=report.category_breakdown,
            strengths=report.strengths,
            weak_topics=report.weak_topics,
            improvement_roadmap=report.improvement_roadmap,
        )
        self.session.add(record)
        await self.session.flush()
        return record

    def to_schema(self, record: InterviewSessionRecord) -> InterviewSession:
        history = [
            HistoryItem(
                round=InterviewRound(answer.round),
                question=answer.question,
                answer=answer.answer,
                feedback=RoundFeedback(
                    score=answer.score,
                    verdict="fail" if answer.score <= 3 else "average" if answer.score <= 6 else "good" if answer.score <= 8 else "excellent",
                    strengths=answer.strengths,
                    weaknesses=answer.weaknesses,
                    improvements=["Review the feedback report for the next step.", "Add more role-specific detail in the next answer."],
                    final_feedback="Saved answer review.",
                    next_action="next_phase",
                    follow_up_question=answer.follow_up_question,
                ),
            )
            for answer in sorted(record.answers, key=lambda item: item.id)
        ]
        return InterviewSession(
            id=record.id,
            role=record.role,
            difficulty=record.difficulty,
            mode=record.mode,
            current_round=InterviewRound(record.current_round),
            current_question=record.current_question,
            history=history,
            scores=record.scores,
            state=InterviewState(record.state),
        )

    def report_to_schema(self, record: FeedbackReportRecord, role: str) -> FinalReport:
        return FinalReport(
            session_id=record.session_id,
            role=role,
            overall_score=record.overall_score,
            category_breakdown=record.category_breakdown,
            strengths=record.strengths,
            weak_topics=record.weak_topics,
            improvement_roadmap=record.improvement_roadmap,
        )

    def _base_session_query(self) -> Select[tuple[InterviewSessionRecord]]:
        return select(InterviewSessionRecord).options(
            selectinload(InterviewSessionRecord.answers),
            selectinload(InterviewSessionRecord.report),
        )
