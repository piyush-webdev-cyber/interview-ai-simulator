from typing import Literal

from pydantic import BaseModel, Field

from app.models.session import InterviewRound, InterviewState


class RoundFeedback(BaseModel):
    question: str | None = None
    score: float = Field(ge=0, le=10)
    verdict: Literal["fail", "average", "good", "excellent"]
    correct: bool | None = None
    expected_answer: str | None = None
    explanation: str | None = None
    strengths: list[str] = Field(min_length=2, max_length=2)
    weaknesses: list[str] = Field(min_length=2, max_length=2)
    improvements: list[str] = Field(min_length=2, max_length=2)
    final_feedback: str = Field(min_length=1)
    next_action: Literal["stop", "next_phase", "complete"]
    next_phase: Literal["practice", "mock", "rapid_fire"] | None = None
    follow_up_question: str | None = None
    next_question: str | None = None
    hint: str | None = None
    ideal_answer: str | None = None
    missing_points: list[str] = []
    improvement_tips: list[str] = []
    level: Literal["easy", "medium", "hard"] | None = None
    next_focus_area: str | None = None
    progress: str | None = None


class VoiceMetrics(BaseModel):
    transcript_confidence: float | None = Field(default=None, ge=0, le=1)
    average_volume: float | None = None
    peak_volume: float | None = None
    used_voice_input: bool = False


class HistoryItem(BaseModel):
    round: InterviewRound
    question: str
    answer: str | None = None
    feedback: RoundFeedback | None = None


class InterviewSession(BaseModel):
    id: str
    role: str
    difficulty: str
    mode: str = "Practice Mode"
    total_questions: int = 3
    current_round: InterviewRound
    current_question: str
    history: list[HistoryItem] = []
    scores: dict[str, float] = {}
    state: InterviewState = InterviewState.ACTIVE


class StartInterviewRequest(BaseModel):
    role: str = Field(min_length=2, max_length=120)
    difficulty: str = "Intermediate"
    mode: str = "Practice Mode"


class StartInterviewResponse(BaseModel):
    session: InterviewSession


class NextQuestionRequest(BaseModel):
    session_id: str


class SubmitAnswerRequest(BaseModel):
    session_id: str
    answer: str = Field(min_length=1)
    voice_metrics: VoiceMetrics | None = None


class SubmitAnswerResponse(BaseModel):
    session: InterviewSession
    feedback: RoundFeedback
    is_completed: bool


class FinalReport(BaseModel):
    session_id: str
    role: str
    overall_score: float
    category_breakdown: dict[str, float]
    strengths: list[str]
    weak_topics: list[str]
    improvement_roadmap: list[str]
    accuracy: float | None = None
    speed_rating: Literal["slow", "average", "fast"] | None = None
    final_verdict: Literal["fail", "average", "good", "excellent"] | None = None
    recommendation: str | None = None

class AnswerReview(BaseModel):
    role: str
    mode: str
    difficulty: str
    question: str
    answer: str
    score: float
    verdict: Literal["fail", "average", "good", "excellent"]
    feedback: str
    weaknesses: list[str]


class ProgressSummary(BaseModel):
    total_interviews: int
    average_score: float
    mode_unlocks: dict[str, bool]
    recommended_next_mode: str | None = None
    difficulty_unlocks: dict[str, bool]
    recommended_difficulty: str | None = None
    difficulty_phase_status: dict[str, dict[str, bool]]
    role_phase_status: dict[str, dict[str, dict[str, bool]]] = Field(default_factory=dict)
    score_trends: list[dict[str, float | str]]
    weak_topics: list[str]
    recent_answer_reviews: list[AnswerReview]
    recent_sessions: list[InterviewSession]


class RoleOption(BaseModel):
    title: str
    category: str
    topics: list[str]


class InterviewCatalog(BaseModel):
    roles: list[RoleOption]
    modes: list[str]
    difficulties: list[str]
    rounds: list[str]


class RoleSuggestionsResponse(BaseModel):
    suggestions: list[str]


class RewrittenExample(BaseModel):
    original: str
    improved: str


class ResumeAnalysisRequest(BaseModel):
    target_role: str = Field(min_length=2, max_length=120)
    resume_text: str = Field(min_length=30, max_length=20000)


class ResumeAnalysisResponse(BaseModel):
    ats_score: float = Field(ge=0, le=100)
    verdict: Literal["poor", "average", "good", "strong", "excellent"]
    missing_keywords: list[str]
    strengths: list[str]
    weaknesses: list[str]
    improvements: list[str]
    rewritten_examples: list[RewrittenExample]
    final_feedback: str


class ResumeFileAnalysisRequest(BaseModel):
    target_role: str = Field(min_length=2, max_length=120)
    file_name: str = Field(min_length=3, max_length=255)
    file_mime_type: str | None = None
    file_base64: str = Field(min_length=20)
