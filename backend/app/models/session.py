from enum import StrEnum


class InterviewRound(StrEnum):
    INTRO = "Intro"
    BEHAVIORAL = "Behavioral"
    DOMAIN = "Domain"
    FINAL = "Final"
    FEEDBACK = "Feedback Report"


class InterviewState(StrEnum):
    ACTIVE = "active"
    COMPLETED = "completed"

ROUND_ORDER = [
    InterviewRound.BEHAVIORAL,
    InterviewRound.DOMAIN,
    InterviewRound.FINAL,
]
