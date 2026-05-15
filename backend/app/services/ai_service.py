import base64
import io
import json
import zipfile
from xml.etree import ElementTree as ET
from typing import Any, Literal

from openai import APIConnectionError, APIStatusError, AsyncOpenAI
from pypdf import PdfReader

from app.core.config import settings
from app.models.session import InterviewRound
from app.schemas.interview import (
    FinalReport,
    HistoryItem,
    ResumeAnalysisResponse,
    RoleSuggestionsResponse,
    RoundFeedback,
    VoiceMetrics,
)
from app.services.prompt_templates import (
    EVALUATION_PROMPT,
    PRACTICE_EVALUATION_PROMPT,
    PRACTICE_QUESTION_PROMPT,
    QUESTION_PROMPT,
    RESUME_ANALYSIS_PROMPT,
    RAPID_FIRE_EVALUATION_PROMPT,
    RAPID_FIRE_QUESTION_PROMPT,
    RAPID_FIRE_REPORT_PROMPT,
    REPORT_PROMPT,
    ROLE_SUGGESTIONS_PROMPT,
)


class AIService:
    def __init__(self) -> None:
        self.client = (
            AsyncOpenAI(api_key=settings.groq_api_key, base_url=settings.groq_base_url)
            if settings.groq_api_key
            else None
        )

    async def generate_question(
        self,
        role: str,
        difficulty: str,
        round_name: InterviewRound,
        mode: str,
        history: list[HistoryItem],
        weak_areas: list[str] | None = None,
        topic: str | None = None,
        question_index: int | None = None,
        total_questions: int | None = None,
    ) -> str:
        if mode == "Practice Mode":
            return self._fallback_practice_question(role, weak_areas, topic, question_index or (len(history) + 1))
        if not self.client:
            return self._fallback_question(role, round_name, history, mode, weak_areas, topic, question_index, total_questions)
        try:
            if mode == "Practice Mode":
                prompt = PRACTICE_QUESTION_PROMPT.format(
                    role=role,
                    difficulty=difficulty,
                    weak_areas=self._list_text(weak_areas),
                    history=self._history_text(history),
                    topic=topic or "Role fundamentals",
                )
            elif mode == "Rapid Fire Mode":
                prompt = RAPID_FIRE_QUESTION_PROMPT.format(
                    role=role,
                    difficulty=difficulty,
                    index=question_index or (len(history) + 1),
                    total=total_questions or 10,
                    history=self._history_text(history),
                )
            else:
                prompt = QUESTION_PROMPT.format(
                    role=role,
                    difficulty=difficulty,
                    round_name=round_name.value,
                    mode=mode,
                    history=self._history_text(history),
                )
            response = await self.client.chat.completions.create(
                model=settings.groq_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
            )
            generated_question = response.choices[0].message.content.strip()
            if mode == "Practice Mode" and self._practice_question_is_repeated_or_meta(generated_question, history):
                return self._fallback_practice_question(role, weak_areas, topic, question_index or (len(history) + 1))
            return generated_question
        except (APIConnectionError, APIStatusError, TimeoutError, ValueError):
            return self._fallback_question(role, round_name, history, mode, weak_areas, topic, question_index, total_questions)

    async def evaluate_answer(
        self,
        role: str,
        mode: str,
        round_name: InterviewRound,
        question: str,
        answer: str,
        previous_scores: list[float] | None = None,
        voice_metrics: VoiceMetrics | None = None,
        history: list[HistoryItem] | None = None,
        weak_areas: list[str] | None = None,
        topic: str | None = None,
    ) -> RoundFeedback:
        if self._is_trivially_inadequate_answer(answer):
            if mode == "Practice Mode":
                return self._practice_failure_feedback(round_name, question, role, answer)
            return self._trivial_failure_feedback(round_name, answer, mode)
        if not self.client:
            return self._fallback_feedback(mode, round_name, question, role, answer, previous_scores, voice_metrics, history, weak_areas, topic)
        try:
            phase = self._phase_for_mode(mode)
            if mode == "Practice Mode":
                prompt = PRACTICE_EVALUATION_PROMPT.format(
                    role=role,
                    weak_areas=self._list_text(weak_areas),
                    history=self._history_text(history or []),
                    topic=topic or round_name.value,
                    question=question,
                    answer=answer,
                    voice_metrics=self._voice_metrics_text(voice_metrics),
                )
            elif mode == "Rapid Fire Mode":
                prompt = RAPID_FIRE_EVALUATION_PROMPT.format(
                    role=role,
                    difficulty="Rapid Fire",
                    index=(len(history or []) + 1),
                    total=10,
                    question=question,
                    answer=answer,
                    voice_metrics=self._voice_metrics_text(voice_metrics),
                )
            else:
                prompt = EVALUATION_PROMPT.format(
                    role=role,
                    phase=phase,
                    round_name=round_name.value,
                    question=question,
                    answer=answer,
                    previous_scores=self._scores_text(previous_scores),
                    voice_metrics=self._voice_metrics_text(voice_metrics),
                )
            response = await self.client.chat.completions.create(
                model=settings.groq_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            feedback = RoundFeedback.model_validate_json(response.choices[0].message.content)
            if mode == "Practice Mode":
                return self._enforce_practice_feedback_rules(feedback, question, role, answer, topic or round_name.value)
            if mode == "Rapid Fire Mode":
                return self._enforce_rapid_fire_feedback_rules(feedback, question, role, answer, voice_metrics)
            return self._enforce_feedback_rules(feedback, phase, question, role, answer)
        except (APIConnectionError, APIStatusError, TimeoutError, ValueError):
            return self._fallback_feedback(mode, round_name, question, role, answer, previous_scores, voice_metrics, history, weak_areas, topic)

    async def create_report(self, session_id: str, role: str, history: list[HistoryItem]) -> FinalReport:
        if not self.client:
            return self._fallback_report(session_id, role, history)
        try:
            prompt_template = RAPID_FIRE_REPORT_PROMPT if len(history) == 10 and all(item.round == InterviewRound.FINAL for item in history) else REPORT_PROMPT
            prompt = prompt_template.format(role=role, history=self._history_text(history))
            response = await self.client.chat.completions.create(
                model=settings.groq_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            payload: dict[str, Any] = json.loads(response.choices[0].message.content)
            report = FinalReport(session_id=session_id, role=role, **payload)
            return self._enforce_report_rules(report, session_id, role, history)
        except (APIConnectionError, APIStatusError, TimeoutError, ValueError, json.JSONDecodeError):
            return self._fallback_report(session_id, role, history)

    async def suggest_roles(self, query: str) -> list[str]:
        normalized_query = query.strip()
        if len(normalized_query) < 2:
            return []
        shorthand_match = self._normalize_shorthand_role(normalized_query)
        if shorthand_match:
            return [shorthand_match]
        if not self.client:
            return self._fallback_role_suggestions(normalized_query)
        try:
            prompt = ROLE_SUGGESTIONS_PROMPT.format(query=normalized_query)
            response = await self.client.chat.completions.create(
                model=settings.groq_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.4,
                response_format={"type": "json_object"},
            )
            payload = RoleSuggestionsResponse.model_validate_json(response.choices[0].message.content)
            return self._dedupe_suggestions(payload.suggestions)
        except (APIConnectionError, APIStatusError, TimeoutError, ValueError, json.JSONDecodeError):
            return self._fallback_role_suggestions(normalized_query)

    async def analyze_resume(self, target_role: str, resume_text: str) -> ResumeAnalysisResponse:
        trimmed_role = target_role.strip()
        trimmed_resume = resume_text.strip()
        if not self.client:
            return self._fallback_resume_analysis(trimmed_role, trimmed_resume)
        try:
            prompt = RESUME_ANALYSIS_PROMPT.format(target_role=trimmed_role, resume_text=trimmed_resume)
            response = await self.client.chat.completions.create(
                model=settings.groq_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            analysis = ResumeAnalysisResponse.model_validate_json(response.choices[0].message.content)
            return self._enforce_resume_analysis_rules(analysis, trimmed_role, trimmed_resume)
        except (APIConnectionError, APIStatusError, TimeoutError, ValueError, json.JSONDecodeError):
            return self._fallback_resume_analysis(trimmed_role, trimmed_resume)

    async def analyze_resume_file(
        self,
        target_role: str,
        file_name: str,
        file_base64: str,
        file_mime_type: str | None = None,
    ) -> ResumeAnalysisResponse:
        extracted_text = self._extract_resume_text(file_name, file_base64, file_mime_type)
        return await self.analyze_resume(target_role, extracted_text)

    def _fallback_question(
        self,
        role: str,
        round_name: InterviewRound,
        history: list[HistoryItem],
        mode: str,
        weak_areas: list[str] | None = None,
        topic: str | None = None,
        question_index: int | None = None,
        total_questions: int | None = None,
    ) -> str:
        if mode == "Practice Mode":
            return self._fallback_practice_question(role, weak_areas, topic, question_index or (len(history) + 1))
        if mode == "Rapid Fire Mode":
            rapid_questions = [
                f"What is the core responsibility of a {role}?",
                f"Name one key metric for a {role}.",
                f"What is one common mistake in {role} work?",
                f"When would you escalate an issue in {role}?",
                f"What does optimization mean in {role} context?",
                f"Name one trade-off you manage in {role}.",
                f"What is one tool often used in {role}?",
                f"How do you validate correctness quickly?",
                f"What is one performance risk to watch for?",
                f"What matters most: speed or accuracy, and why?",
            ]
            idx = min(max((question_index or (len(history) + 1)) - 1, 0), len(rapid_questions) - 1)
            return rapid_questions[idx]
        questions = {
            InterviewRound.BEHAVIORAL: f"Tell me about a time you handled ambiguity while working toward a {role} goal.",
            InterviewRound.DOMAIN: f"Walk me through how you would solve a realistic core challenge for a {role} role.",
            InterviewRound.FINAL: "What should I remember about you when comparing you with other strong candidates?",
        }
        if history and history[-1].feedback and history[-1].feedback.follow_up_question:
            return history[-1].feedback.follow_up_question
        return questions.get(round_name, "Tell me about your background and what you want from this role.")

    def _fallback_practice_question(
        self,
        role: str,
        weak_areas: list[str] | None = None,
        topic: str | None = None,
        question_index: int = 1,
    ) -> str:
        questions = self._practice_question_bank(role)
        idx = min(max(question_index - 1, 0), len(questions) - 1)
        selected = questions[idx]
        return selected

    def _practice_question_is_repeated_or_meta(self, question: str, history: list[HistoryItem]) -> bool:
        normalized = " ".join(question.casefold().split())
        if not normalized:
            return True
        blocked_phrases = (
            "take the same topic again",
            "answer it with a concrete example",
            "same topic",
            "weak area",
            "role fundamentals",
            "how would you improve",
        )
        if any(phrase in normalized for phrase in blocked_phrases):
            return True
        previous = {" ".join(item.question.casefold().split()) for item in history}
        return normalized in previous

    def _practice_question_bank(self, role: str) -> list[str]:
        role_key = role.casefold()

        if any(token in role_key for token in ["full stack", "fullstack"]):
            return [
                "Design a small task-management feature end to end. What API endpoints, database tables, and React state would you use?",
                "A page loads slowly after adding filters and pagination. How would you debug whether the bottleneck is frontend, API, or database?",
                "How would you implement authentication so the React app, backend API, and protected routes stay secure?",
                "Describe how you would handle validation for a form that has both client-side checks and server-side business rules.",
                "If production users report intermittent 500 errors after a deploy, what logs and code paths would you inspect first?",
            ]

        if any(token in role_key for token in ["frontend", "front end", "react", "web developer"]):
            return [
                "How would you build a reusable search-and-filter table in React while keeping rendering performance under control?",
                "A form looks correct but screen-reader users cannot complete it. What accessibility issues would you check first?",
                "Explain how you would manage loading, error, and empty states for a dashboard that calls multiple APIs.",
                "When would you use local component state, context, and a server-state cache in the same React app?",
                "A mobile layout breaks at narrow widths. How would you debug and fix the responsive CSS?",
            ]

        if any(token in role_key for token in ["backend", "api", "server"]):
            return [
                "Design an API endpoint for creating an interview session. What request body, validation, response, and errors would you define?",
                "A database query is slowing down a user dashboard. How would you inspect and optimize it?",
                "How would you structure authentication and authorization for user-owned resources in a REST API?",
                "Describe how you would make a background job retry safely without creating duplicate records.",
                "What would you log and monitor for an API that occasionally returns 500 errors in production?",
            ]

        if any(token in role_key for token in ["software", "sde", "developer", "engineer"]):
            return [
                "Walk through how you would design a rate limiter for an API. What data structure or storage would you use?",
                "Given a bug that appears only in production, what steps would you take to reproduce, isolate, and fix it?",
                "How would you refactor duplicated business logic without changing behavior?",
                "Explain a trade-off you would consider when choosing between SQL and NoSQL for a new feature.",
                "How would you test a critical function that handles edge cases and external failures?",
            ]

        if any(token in role_key for token in ["data analyst", "business analyst", "analyst"]):
            return [
                "A stakeholder asks why weekly signups dropped by 20%. What data would you pull and how would you structure the analysis?",
                "How would you define a reliable KPI for user activation in a product dashboard?",
                "You find two reports with different revenue numbers. How would you investigate the discrepancy?",
                "Explain how you would present an insight that is statistically uncertain but business-relevant.",
                "What SQL query approach would you use to compare cohort retention across months?",
            ]

        if any(token in role_key for token in ["data scientist", "machine learning", "ml", "ai"]):
            return [
                "How would you decide whether a classification model is good enough to ship for a business use case?",
                "A model performs well offline but poorly in production. What would you investigate first?",
                "Explain how you would handle missing and imbalanced data before training a model.",
                "How would you communicate precision, recall, and trade-offs to a non-technical stakeholder?",
                "What monitoring would you add to detect model drift after deployment?",
            ]

        if any(token in role_key for token in ["devops", "cloud", "site reliability", "sre"]):
            return [
                "A service deployment passes CI but fails after release. How would you roll back and diagnose it?",
                "How would you design a CI/CD pipeline for a backend service with tests, migrations, and deployment gates?",
                "What metrics and alerts would you configure for a high-traffic API?",
                "How would you investigate a sudden increase in latency across multiple services?",
                "Explain how you would manage secrets and environment config across dev, staging, and production.",
            ]

        if any(token in role_key for token in ["product manager", "product owner"]):
            return [
                "A feature has high usage but low retention impact. How would you decide whether to keep investing in it?",
                "How would you prioritize three roadmap items when engineering capacity only allows one this sprint?",
                "Describe how you would turn vague customer feedback into a clear product requirement.",
                "What metrics would you use to judge whether an onboarding redesign succeeded?",
                "How would you handle a disagreement between sales, design, and engineering on feature scope?",
            ]

        if any(token in role_key for token in ["ux", "ui", "designer", "researcher"]):
            return [
                "How would you redesign a signup flow that has a high drop-off rate on mobile?",
                "What research method would you choose to understand why users abandon a dashboard task?",
                "How would you validate whether a new navigation structure is easier to use?",
                "Describe how you would hand off a design to engineering so edge cases are clear.",
                "A stakeholder wants a visually heavier screen. How would you defend usability and hierarchy decisions?",
            ]

        if any(token in role_key for token in ["qa", "quality assurance", "tester"]):
            return [
                "How would you test a checkout flow that includes coupons, payment failure, and order confirmation?",
                "What regression test cases would you prioritize before releasing a login redesign?",
                "How would you decide what to automate versus test manually?",
                "A bug is reported with unclear steps. How would you reproduce and document it?",
                "How would you test API validation for invalid, missing, and boundary-value inputs?",
            ]

        if any(token in role_key for token in ["mobile", "android", "ios", "react native"]):
            return [
                "How would you debug a React Native screen that works on iOS but crashes on Android?",
                "What would you check if a mobile app can reach Metro but cannot reach the backend API?",
                "How would you handle offline state and retry logic for submitting a form?",
                "Explain how you would optimize a long scrolling list in a mobile app.",
                "How would you manage permissions and user messaging for camera or microphone access?",
            ]

        if any(token in role_key for token in ["cyber", "security"]):
            return [
                "How would you investigate a suspicious login pattern for a user account?",
                "What steps would you take to assess whether an API endpoint is vulnerable to authorization bypass?",
                "How would you explain risk severity for a vulnerability to an engineering manager?",
                "What controls would you recommend for protecting secrets in a deployment pipeline?",
                "How would you validate that an input field is protected against injection attacks?",
            ]

        return [
            f"Describe a realistic project or task a {role} handles. What steps would you take from requirement to result?",
            f"What is one common problem in a {role} role, and how would you diagnose it before proposing a solution?",
            f"Tell me about a time a {role} needs to balance speed, quality, and stakeholder expectations. What would you do?",
            f"What tools, metrics, or signals would you use to judge whether your work as a {role} was successful?",
            f"Walk through a concrete example where a {role} must communicate a complex decision clearly.",
        ]

    def _practice_topic_question(self, role: str, topic: str, question_index: int) -> str:
        templates = [
            "Give a concrete example of how you would handle {topic} in a {role} role. What steps would you take?",
            "What mistake do candidates often make with {topic} in a {role} interview, and how would you avoid it?",
            "Walk through a real scenario where {topic} matters for a {role}. What decision would you make and why?",
            "How would you explain {topic} to a teammate or stakeholder while working as a {role}?",
            "What evidence would show that you handled {topic} well in a {role} role?",
        ]
        return templates[min(max(question_index - 1, 0), len(templates) - 1)].format(role=role, topic=topic)

    def _fallback_feedback(
        self,
        mode: str,
        round_name: InterviewRound,
        question: str,
        role: str,
        answer: str,
        previous_scores: list[float] | None = None,
        voice_metrics: VoiceMetrics | None = None,
        history: list[HistoryItem] | None = None,
        weak_areas: list[str] | None = None,
        topic: str | None = None,
    ) -> RoundFeedback:
        del previous_scores
        del history
        normalized = answer.strip()
        word_count = len(normalized.split())
        if mode == "Practice Mode":
            diagnostics = self._practice_answer_diagnostics(question, role, answer)
            if diagnostics["gibberish"]:
                score = 0.5
            elif not diagnostics["related"]:
                score = 1.5 if word_count >= 20 else 1.0
            elif word_count < 30:
                score = 3.5
            elif word_count < 80:
                score = 5.0
            elif word_count < 150:
                score = 6.3
            elif diagnostics["marker_hits"] < 4:
                score = 6.8
            else:
                score = 7.5
            strong_floor = self._practice_strong_answer_floor(question, role, answer)
            if strong_floor is not None:
                score = max(score, strong_floor)
            level: Literal["easy", "medium", "hard"] = "easy" if score < 5 else "medium" if score < 7 else "hard"
            hint = None
            if word_count < 10:
                hint = "Try: situation, action, result. Mention one concrete tool, decision, or measurable outcome."
            feedback = RoundFeedback(
                score=score,
                verdict="fail" if score <= 3 else "average" if score <= 6 else "good" if score <= 8 else "excellent",
                strengths=[
                    "The answer at least addresses the topic." if normalized else "There is enough of a response to diagnose the gap.",
                    "You gave some signal about your current thinking." if word_count >= 10 else "The short answer makes the missing depth obvious.",
                ],
                weaknesses=[
                    "The answer does not show enough role-specific depth.",
                    "The explanation needs clearer structure and more concrete evidence.",
                ],
                improvements=[
                    "Use a tighter structure: context, action, result, lesson.",
                    "Add one concrete example or measurable detail.",
                ],
                final_feedback=self._practice_final_feedback_for_answer(question, role, answer, score),
                next_action="next_phase",
                next_phase=None,
                follow_up_question=f"Take the same topic again, but answer it with a concrete example focused on {topic or weak_areas[0] if weak_areas else 'the weak area'}.",
                hint=hint,
                ideal_answer=f"A stronger answer for a {role} would explain the situation, the decision you made, the specific action you took, and the result you achieved.",
                missing_points=self._practice_missing_points_for_answer(question, role, answer),
                improvement_tips=self._practice_improvement_tips_for_answer(question, role, answer),
                level=level,
                next_focus_area=topic or (weak_areas[0] if weak_areas else "role fundamentals"),
            )
            return self._enforce_practice_feedback_rules(feedback, question, role, answer, topic or (weak_areas[0] if weak_areas else round_name.value))
        if mode == "Rapid Fire Mode":
            score = 2.0 if word_count < 10 and self._is_related_short_answer(question, role, answer) else 1.0 if word_count < 10 else 4.5 if word_count < 20 else 6.5 if word_count < 40 else 7.5
            feedback = RoundFeedback(
                question=question,
                score=score,
                verdict="fail" if score <= 3 else "average" if score <= 6 else "good" if score <= 8 else "excellent",
                correct=score >= 6,
                expected_answer=f"A concise correct answer for '{question}' in the context of {role}.",
                explanation="Answer directly, define the concept cleanly, and avoid filler.",
                strengths=[
                    "The answer attempts the concept directly.",
                    "There is enough content to judge clarity and correctness.",
                ],
                weaknesses=[
                    "The answer needs tighter recall and cleaner precision.",
                    "The response does not land the concept sharply enough.",
                ],
                improvements=[
                    "Answer in one or two precise sentences.",
                    "State the concept first, then the key implication.",
                ],
                final_feedback="Fast round. Be more precise and direct.",
                next_action="complete",
                next_phase=None,
            )
            return self._enforce_rapid_fire_feedback_rules(feedback, question, role, answer, voice_metrics)
        if not normalized or word_count <= 1:
            base_score = 1.0
        elif word_count < 5:
            base_score = 2.0
        elif word_count < 10:
            base_score = 3.5
        elif word_count < 20:
            base_score = 4.5
        elif word_count < 35:
            base_score = 5.5
        else:
            base_score = 6.0
        feedback = RoundFeedback(
            score=base_score,
            verdict="fail" if base_score <= 3 else "average" if base_score <= 6 else "good" if base_score <= 8 else "excellent",
            strengths=[
                "You attempted to answer the question directly." if normalized else "There is at least a response to assess.",
                "The answer gives some signal about your thinking." if word_count >= 10 else "The response is short enough to reveal its lack of depth immediately.",
            ],
            weaknesses=[
                "The answer lacks enough concrete detail to sound convincing.",
                "You did not build a structured explanation with context, action, and outcome.",
            ],
            improvements=[
                "Use a concrete example with measurable outcomes instead of generic claims.",
                "Answer in a tighter structure so the reasoning is obvious.",
            ],
            final_feedback="This answer is not strong enough as delivered." if base_score < 6 else "The answer is passable, but it still needs more depth and precision.",
            next_action="complete" if self._phase_for_mode(mode) == "rapid_fire" else "next_phase",
            next_phase="mock" if self._phase_for_mode(mode) == "practice" else "rapid_fire" if self._phase_for_mode(mode) == "mock" else None,
            follow_up_question=None if round_name == InterviewRound.FINAL else "Give a concrete example and explain the measurable impact.",
        )
        return self._enforce_feedback_rules(feedback, self._phase_for_mode(mode), question, role, answer)

    def _fallback_report(self, session_id: str, role: str, history: list[HistoryItem]) -> FinalReport:
        scores = [item.feedback.score for item in history if item.feedback]
        overall = round(sum(scores) / len(scores), 1) if scores else 0
        is_rapid_fire = len(history) == 10 and all(item.round == InterviewRound.FINAL for item in history)
        accuracy = round((sum(1 for item in history if item.feedback and item.feedback.correct) / len(history)) * 100, 1) if is_rapid_fire and history else None
        speed_rating = None
        if is_rapid_fire:
            avg_confidence = self._average_voice_confidence(history)
            if avg_confidence >= 0.85:
                speed_rating = "fast"
            elif avg_confidence >= 0.55:
                speed_rating = "average"
            else:
                speed_rating = "slow"
        final_verdict = "fail" if overall <= 3 else "average" if overall <= 6 else "good" if overall <= 8 else "excellent"
        report = FinalReport(
            session_id=session_id,
            role=role,
            overall_score=overall,
            category_breakdown={
                "Communication": overall,
                "Domain knowledge": max(0, overall - 0.4),
                "Problem-solving": max(0, overall - 0.2),
                "Confidence": min(10, overall + 0.3),
            },
            strengths=["Relevant answers", "Interview stamina", "Role motivation"],
            weak_topics=["Specific metrics", "Structured examples", "Deeper trade-off analysis"],
            improvement_roadmap=[
                "Prepare five STAR stories with measurable outcomes.",
                "Practice concise first-pass answers under two minutes.",
                "Review role-specific fundamentals and common scenarios.",
                "Record mock answers and refine clarity, pacing, and confidence.",
            ],
            accuracy=accuracy,
            speed_rating=speed_rating,
            final_verdict=final_verdict,
            recommendation="Sharpen recall speed and answer with cleaner definitions." if is_rapid_fire else None,
        )
        return self._enforce_report_rules(report, session_id, role, history)

    def _fallback_role_suggestions(self, query: str) -> list[str]:
        shorthand_match = self._normalize_shorthand_role(query)
        if shorthand_match:
            return [shorthand_match]
        common_roles = [
            "Frontend Developer",
            "Backend Developer",
            "Full Stack Developer",
            "Web Developer",
            "Mobile Developer",
            "React Developer",
            "Ethical Hacker",
            "Cybersecurity Analyst",
            "Financial Analyst",
            "Software Testing Engineer",
            "JS Developer",
            "DSA Engineer",
            "Network Engineer",
            "Electrical Engineer",
            "Digital Marketer",
            "Graphic Designer",
            "SEO Specialist",
            "Data Scientist",
            "Data Analyst",
            "DevOps Engineer",
            "Product Manager",
            "UI/UX Designer",
            "Sales Executive",
            "HR Manager",
            "Marketing Specialist",
            "Business Analyst",
            "QA Engineer",
            "Machine Learning Engineer",
            "Customer Success Manager",
            "Operations Manager",
            "Financial Analyst",
            "Content Strategist",
            "Content Writer",
            "Data entry Specialist",
            "MERN Stack Developer",
            "Python Developer",
            "Java Developer",
            "Full stack Developer",
            "PHP Developer",
            "Ruby on Rails Developer",
        ]
        lowered = query.lower()
        starts_with = [role for role in common_roles if lowered in role.lower()]
        if starts_with:
            return self._dedupe_suggestions(starts_with[:5])
        generated = [
            f"{query.title()} Specialist",
            f"Senior {query.title()}",
            f"{query.title()} Analyst",
            f"{query.title()} Manager",
            f"{query.title()} Associate",
        ]
        return self._dedupe_suggestions(generated)

    def _fallback_resume_analysis(self, target_role: str, resume_text: str) -> ResumeAnalysisResponse:
        lower_resume = resume_text.casefold()
        lines = [line.strip() for line in resume_text.splitlines() if line.strip()]
        words = [word for word in resume_text.split() if word.strip()]
        bullets = [line for line in lines if line.startswith(("-", "*", "•"))]
        metrics_hits = sum(1 for token in words if any(ch.isdigit() for ch in token))
        sections = {
            "summary": any("summary" in line.casefold() or "profile" in line.casefold() for line in lines),
            "skills": any("skills" in line.casefold() or "technical skills" in line.casefold() for line in lines),
            "experience": any("experience" in line.casefold() or "employment" in line.casefold() for line in lines),
            "projects": any("projects" in line.casefold() or "project" in line.casefold() for line in lines),
        }
        keyword_bank = self._resume_keywords_for_role(target_role)
        missing_keywords = [keyword for keyword in keyword_bank if keyword.casefold() not in lower_resume][:8]
        found_keywords = len(keyword_bank) - len(missing_keywords)

        score = 28.0
        score += min(found_keywords * 5.0, 30.0)
        score += 12.0 if sections["skills"] else 0.0
        score += 12.0 if sections["experience"] else 0.0
        score += 8.0 if sections["projects"] else 0.0
        score += 6.0 if sections["summary"] else 0.0
        score += min(metrics_hits * 2.0, 12.0)
        score += 6.0 if bullets else 0.0
        if len(words) < 120:
            score -= 12.0
        if metrics_hits == 0:
            score -= 10.0
        if not bullets:
            score -= 8.0
        if "table" in lower_resume or "columns" in lower_resume or "graphic" in lower_resume:
            score -= 6.0

        score = round(max(0.0, min(100.0, score)), 1)
        verdict = self._resume_verdict_for_score(score)

        strengths: list[str] = []
        if sections["skills"]:
            strengths.append("The resume includes a dedicated skills section, which helps ATS parsing.")
        if metrics_hits > 0:
            strengths.append("There is at least some measurable evidence instead of purely generic claims.")
        if found_keywords >= max(2, len(keyword_bank) // 3):
            strengths.append(f"The resume mentions some role-relevant language for {target_role}.")
        if not strengths:
            strengths.append("The resume is readable enough to review, even if it is not competitive yet.")

        weaknesses: list[str] = []
        if not sections["summary"]:
            weaknesses.append("There is no clear summary or profile section to frame the candidate quickly.")
        if not sections["projects"]:
            weaknesses.append("Projects are missing or too weak, which hurts proof of practical ability.")
        if metrics_hits == 0:
            weaknesses.append("The bullets do not show measurable impact, so the work sounds generic.")
        if missing_keywords:
            weaknesses.append(f"Important {target_role} keywords are missing, which weakens ATS relevance.")
        if len(words) < 120:
            weaknesses.append("The resume is too thin to compete for serious shortlisting.")
        weaknesses = weaknesses[:4] or ["The resume is too generic and does not sell the candidate strongly enough."]

        improvements = [
            "Rewrite weak bullets to show action, scope, and measurable outcomes.",
            f"Add missing {target_role} keywords naturally into skills, experience, and projects.",
            "Make sure the structure is ATS-friendly: Summary, Skills, Experience, Projects.",
            "Replace vague statements with role-specific achievements and tools.",
        ]

        weak_line = next((line for line in bullets if self._line_looks_weak(line)), bullets[0] if bullets else None)
        rewritten_examples = []
        if weak_line:
            rewritten_examples.append(
                {
                    "original": weak_line,
                    "improved": self._improved_resume_bullet(weak_line, target_role),
                }
            )
        else:
            rewritten_examples.append(
                {
                    "original": "Worked on projects and handled responsibilities.",
                    "improved": f"Built and delivered {target_role}-relevant work with clear scope, tools, and measurable business impact.",
                }
            )

        final_feedback = (
            f"This resume is {verdict}. It is not competitive enough yet for {target_role} because it lacks stronger "
            "keywords, sharper impact bullets, and cleaner ATS-oriented positioning."
        )

        return ResumeAnalysisResponse(
            ats_score=score,
            verdict=verdict,
            missing_keywords=missing_keywords,
            strengths=strengths[:3],
            weaknesses=weaknesses[:4],
            improvements=improvements[:4],
            rewritten_examples=rewritten_examples,
            final_feedback=final_feedback,
        )

    def _extract_resume_text(self, file_name: str, file_base64: str, file_mime_type: str | None = None) -> str:
        try:
            raw_bytes = base64.b64decode(file_base64, validate=True)
        except Exception as exc:
            raise ValueError("The uploaded file could not be read. Please try again.") from exc

        lowered_name = file_name.strip().casefold()
        mime = (file_mime_type or "").casefold()

        if lowered_name.endswith((".txt", ".md")) or mime.startswith("text/"):
            return self._decode_text_bytes(raw_bytes)
        if lowered_name.endswith(".docx") or "wordprocessingml.document" in mime:
            return self._extract_docx_text(raw_bytes)
        if lowered_name.endswith(".pdf") or mime == "application/pdf":
            return self._extract_pdf_text(raw_bytes)

        raise ValueError("Unsupported file type. Upload a PDF, DOCX, TXT, or Markdown resume.")

    def _decode_text_bytes(self, raw_bytes: bytes) -> str:
        for encoding in ("utf-8", "utf-16", "latin-1"):
            try:
                text = raw_bytes.decode(encoding)
                if text.strip():
                    return text
            except UnicodeDecodeError:
                continue
        raise ValueError("We couldn't decode that text file. Try saving it as UTF-8 text or upload a PDF or DOCX.")

    def _extract_docx_text(self, raw_bytes: bytes) -> str:
        try:
            with zipfile.ZipFile(io.BytesIO(raw_bytes)) as archive:
                xml_bytes = archive.read("word/document.xml")
        except Exception as exc:
            raise ValueError("That DOCX file could not be parsed. Try exporting it again and re-uploading.") from exc

        root = ET.fromstring(xml_bytes)
        text_chunks = [node.text.strip() for node in root.iter() if node.text and node.text.strip()]
        text = "\n".join(text_chunks).strip()
        if not text:
            raise ValueError("The DOCX file appears empty after extraction.")
        return text

    def _extract_pdf_text(self, raw_bytes: bytes) -> str:
        try:
            reader = PdfReader(io.BytesIO(raw_bytes))
            pages = [page.extract_text() or "" for page in reader.pages]
        except Exception as exc:
            raise ValueError("That PDF could not be read. Try exporting a text-based PDF or upload a DOCX instead.") from exc

        text = "\n".join(page.strip() for page in pages if page and page.strip()).strip()
        if not text:
            raise ValueError("The PDF appears image-based or empty, so no text could be extracted.")
        return text

    def _normalize_shorthand_role(self, query: str) -> str | None:
        shorthand_map = {
            "dsa": "Data Structures and Algorithms",
            "sde": "Software Development Engineer",
            "fe": "Frontend Developer",
        }
        return shorthand_map.get(query.strip().casefold())

    def _dedupe_suggestions(self, suggestions: list[str]) -> list[str]:
        seen: set[str] = set()
        result: list[str] = []
        for item in suggestions:
            cleaned = item.strip()
            key = cleaned.casefold()
            if len(cleaned) < 2 or key in seen:
                continue
            seen.add(key)
            result.append(cleaned)
        return result[:5]

    def _history_text(self, history: list[HistoryItem]) -> str:
        if not history:
            return "No previous answers."
        return "\n".join(
            f"{item.round.value}: Q={item.question} A={item.answer or 'pending'} Score={item.feedback.score if item.feedback else 'pending'}"
            for item in history
        )

    def _voice_metrics_text(self, voice_metrics: VoiceMetrics | None) -> str:
        if not voice_metrics or not voice_metrics.used_voice_input:
            return "No voice metrics provided."

        parts: list[str] = ["Voice input was used."]
        if voice_metrics.transcript_confidence is not None:
            parts.append(f"Transcript confidence: {voice_metrics.transcript_confidence:.2f}")
        if voice_metrics.average_volume is not None:
            parts.append(f"Average vocal energy: {voice_metrics.average_volume:.2f}")
        if voice_metrics.peak_volume is not None:
            parts.append(f"Peak vocal energy: {voice_metrics.peak_volume:.2f}")
        return " ".join(parts)

    def _phase_for_mode(self, mode: str) -> Literal["mock", "practice", "rapid_fire"]:
        if mode == "Practice Mode":
            return "practice"
        if mode == "Rapid Fire Mode":
            return "rapid_fire"
        return "mock"

    def _scores_text(self, previous_scores: list[float] | None) -> str:
        if not previous_scores:
            return "No previous scores."
        return ", ".join(f"{score:.1f}" for score in previous_scores)

    def _enforce_feedback_rules(
        self,
        feedback: RoundFeedback,
        phase: Literal["mock", "practice", "rapid_fire"],
        question: str,
        role: str,
        answer: str,
    ) -> RoundFeedback:
        normalized = " ".join(answer.split())
        word_count = len(normalized.split())
        lower = normalized.casefold()
        auto_fail = not normalized or word_count <= 2
        weak_explanation = word_count < 8
        clearly_irrelevant_markers = {"idk", "i don't know", "dont know", "no idea", "n/a", "skip", "ok", "okay", "yes", "no", "maybe", "sure", "alright"}
        if lower in clearly_irrelevant_markers:
            auto_fail = True

        score = float(feedback.score)
        model_hint_floor = self._mock_model_hint_answer_floor(question, role, answer) if phase == "mock" else None
        if auto_fail:
            score = min(score, 1.0)
        elif word_count < 10:
            if self._is_related_short_answer(question, role, answer):
                score = 2.0
            else:
                score = 0.0 if word_count <= 2 else 1.0
        elif weak_explanation:
            score = min(score, 2.5)
        if model_hint_floor is not None:
            score = max(score, model_hint_floor)

        if score <= 3:
            verdict: Literal["fail", "average", "good", "excellent"] = "fail"
        elif score <= 6:
            verdict = "average"
        elif score <= 8:
            verdict = "good"
        else:
            verdict = "excellent"

        if phase == "rapid_fire":
            next_action: Literal["stop", "next_phase", "complete"] = "complete"
            next_phase: Literal["practice", "rapid_fire"] | None = None
        elif score < 7:
            next_action = "stop"
            next_phase = None
        elif phase == "practice":
            next_action = "next_phase"
            next_phase = "mock"
        else:
            next_action = "next_phase"
            next_phase = "rapid_fire"

        strengths = list(feedback.strengths[:2])
        while len(strengths) < 2:
            strengths.append("There is at least enough content to assess the answer.")

        weaknesses = list(feedback.weaknesses[:2])
        while len(weaknesses) < 2:
            weaknesses.append("The explanation is not strong enough yet.")

        improvements = list(feedback.improvements[:2])
        while len(improvements) < 2:
            improvements.append("Add specifics and structure instead of staying generic.")

        if model_hint_floor is not None and score >= 8:
            final_feedback = "This is a strong mock interview answer because it uses the model-answer structure, stays on the prompt, gives a concrete example, explains actions and trade-offs, and ends with a clear result."
        else:
            final_feedback = feedback.final_feedback.strip() or "The answer is not good enough."
        if score < 7 and "not" not in final_feedback.casefold():
            final_feedback = f"{final_feedback} It is not strong enough to justify moving forward."

        follow_up_question = feedback.follow_up_question
        if next_action != "next_phase":
            follow_up_question = None

        return RoundFeedback(
            score=round(max(0, min(10, score)), 1),
            verdict=verdict,
            strengths=strengths,
            weaknesses=weaknesses,
            improvements=improvements,
            final_feedback=final_feedback,
            next_action=next_action,
            next_phase=next_phase,
            follow_up_question=follow_up_question,
        )

    def _mock_model_hint_answer_floor(self, question: str, role: str, answer: str) -> float | None:
        normalized = " ".join(answer.split())
        word_count = len(normalized.split())
        if not self._is_app_model_hint_answer(question, role, normalized):
            return None
        return 9.0 if word_count >= 90 else 8.2

    def _is_trivially_inadequate_answer(self, answer: str) -> bool:
        normalized = " ".join(answer.split()).casefold()
        if not normalized:
            return True

        trivial_phrases = {
            "yes",
            "no",
            "yep",
            "nope",
            "lol",
            "lmao",
            "rofl",
            "haha",
            "hehe",
            "maybe",
            "idk",
            "i dont know",
            "i don't know",
            "dont know",
            "don't know",
            "n/a",
            "skip",
            "pass",
            "ok",
            "okay",
            "alright",
            "sure",
            "got it",
            "understood",
            "cool",
            "nice",
            "good",
            "bad",
            "fine",
        }
        if normalized in trivial_phrases:
            return True

        words = normalized.split()
        if len(words) <= 2:
            return True

        return self._looks_like_gibberish(normalized)

    def _looks_like_gibberish(self, text: str) -> bool:
        normalized = " ".join(text.casefold().split())
        if not normalized:
            return True

        words = normalized.split()
        if len(words) >= 4 and len(set(words)) <= max(1, len(words) // 4):
            return True

        keyboard_noise = {"asdf", "qwer", "qwerty", "zxcv", "hjkl", "abcd", "testtest", "blah", "random"}
        if any(word in keyboard_noise for word in words):
            return True

        compact = "".join(ch for ch in normalized if ch.isalpha())
        if len(compact) >= 12:
            vowel_count = sum(1 for ch in compact if ch in "aeiou")
            if vowel_count / len(compact) < 0.15:
                return True

        return False

    def _trivial_failure_feedback(self, round_name: InterviewRound, answer: str, mode: str) -> RoundFeedback:
        del answer
        phase = self._phase_for_mode(mode)
        next_action: Literal["stop", "next_phase", "complete"]
        next_phase: Literal["mock", "rapid_fire"] | None
        if phase == "rapid_fire":
            next_action = "complete"
            next_phase = None
        elif phase == "practice":
            next_action = "next_phase"
            next_phase = None
        else:
            next_action = "stop"
            next_phase = None

        return RoundFeedback(
            score=1.0,
            verdict="fail",
            strengths=[
                "There is at least a response to evaluate.",
                "The answer was short enough to make the lack of substance obvious immediately.",
            ],
            weaknesses=[
                "This answer is far too short to demonstrate competence.",
                "There is no explanation, evidence, or reasoning to assess.",
            ],
            improvements=[
                "Answer with a concrete example instead of a one-word reply.",
                "Explain what you did, why you did it, and what happened.",
            ],
            final_feedback="This answer fails immediately. It does not show understanding, judgment, or communication ability." if phase != "practice" else "This answer is too thin to help you improve. You need to give enough substance to coach.",
            next_action=next_action,
            next_phase=next_phase,
            follow_up_question="Try again with a simple structure: situation, action, result." if phase == "practice" else None,
            hint="Give one real example, what you did, and what happened." if phase == "practice" else None,
            ideal_answer="A stronger answer would name one real situation, explain your action, and describe the result." if phase == "practice" else None,
            missing_points=["Concrete example", "Reasoning", "Outcome"] if phase == "practice" else [],
            improvement_tips=["Use STAR in short form.", "Say what changed because of your action."] if phase == "practice" else [],
            level="easy" if phase == "practice" else None,
            next_focus_area=round_name.value if phase == "practice" else None,
        )

    def _practice_failure_feedback(self, round_name: InterviewRound, question: str, role: str, answer: str) -> RoundFeedback:
        diagnostics = self._practice_answer_diagnostics(question, role, answer)
        if diagnostics["gibberish"] or not diagnostics["related"]:
            final_feedback = "Please answer related to the question. Random text or unrelated content cannot be evaluated for this role."
            weaknesses = [
                "The response does not connect to the prompt.",
                f"It does not show {role} knowledge or a usable example.",
            ]
            improvements = [
                "Read the question again and answer that exact topic.",
                "Write 200-250 words with a realistic example, steps, reasoning, and result.",
            ]
            hint = "Use words from the question, then give one realistic example of what you would do and why."
            missing_points = ["On-topic answer", "Role-specific detail", "Concrete example"]
            tips = [
                "Please answer the actual question instead of typing unrelated text.",
                f"Mention the {role} context and use words from the prompt.",
                "Give one real or realistic example with action and result.",
            ]
        else:
            final_feedback = "This is related, but it is too short to evaluate properly. Aim for at least 200-250 words in Practice Mode."
            weaknesses = [
                "The answer is too short to show competence.",
                "There is no clear reasoning, example, or outcome.",
            ]
            improvements = [
                "Expand the answer into situation, approach, trade-off, validation, and result.",
                "Add one concrete implementation detail or measurable outcome.",
            ]
            hint = "Use STAR: situation, task, action, result. Add one concrete detail."
            missing_points = ["200-250 word explanation", "Concrete steps", "Outcome or validation"]
            tips = [
                "Expand this into at least 200-250 words for practice mode.",
                "Use this order: situation, approach, steps, trade-off, result.",
                "Add one concrete tool, decision, or measurable outcome.",
            ]

        return RoundFeedback(
            score=1.0 if diagnostics["gibberish"] or not diagnostics["related"] else 2.0,
            verdict="fail",
            strengths=[
                "The gap is clear enough to coach.",
                "You can recover by rewriting the answer with structure.",
            ],
            weaknesses=weaknesses,
            improvements=improvements,
            final_feedback=final_feedback,
            next_action="next_phase",
            next_phase=None,
            follow_up_question=f"Try again with an on-topic answer for {round_name.value}. What would you do, why, and what result would you expect?",
            hint=hint,
            ideal_answer=f"A stronger {role} answer would directly answer '{question}', give a concrete example, explain the steps, and end with validation or outcome.",
            missing_points=missing_points,
            improvement_tips=tips,
            level="easy",
            next_focus_area=round_name.value,
        )

    def _practice_answer_diagnostics(self, question: str, role: str, answer: str) -> dict[str, int | bool]:
        normalized = " ".join(answer.split())
        answer_tokens = self._meaningful_tokens(normalized)
        context_tokens = self._meaningful_tokens(question) | self._meaningful_tokens(role)
        overlap = len(answer_tokens & context_tokens)
        role_overlap = len(answer_tokens & self._meaningful_tokens(role))
        answer_lower = normalized.casefold()
        marker_hits = sum(1 for marker in self._practice_quality_markers() if marker in answer_lower)
        word_count = len(normalized.split())
        starts_with_model_answer = self._is_app_model_hint_answer(question, role, normalized)
        related = starts_with_model_answer or overlap >= 2 or role_overlap >= 1 or (overlap >= 1 and (marker_hits >= 1 or word_count < 30))
        return {
            "word_count": word_count,
            "overlap": overlap,
            "role_overlap": role_overlap,
            "marker_hits": marker_hits,
            "related": related,
            "gibberish": self._looks_like_gibberish(normalized),
            "starts_with_model_answer": starts_with_model_answer,
        }

    def _is_app_model_hint_answer(self, question: str, role: str, answer: str) -> bool:
        normalized = " ".join(answer.split())
        if not normalized:
            return False

        answer_lower = normalized.casefold().strip(" \"'")
        word_count = len(normalized.split())
        marker_hits = sum(1 for marker in self._practice_quality_markers() if marker in answer_lower)
        answer_tokens = self._meaningful_tokens(normalized)
        context_tokens = self._meaningful_tokens(question) | self._meaningful_tokens(role)
        overlap = len(answer_tokens & context_tokens)

        app_hint_phrases = (
            "i would answer it like this:",
            "this answer should score highly",
            "why this works",
            "model answer",
        )
        has_app_hint_phrase = any(phrase in answer_lower for phrase in app_hint_phrases)
        if not has_app_hint_phrase:
            return False

        return word_count >= 45 and (overlap >= 1 or marker_hits >= 4)

    def _practice_quality_markers(self) -> list[str]:
        return [
            "for example",
            "because",
            "tradeoff",
            "trade-off",
            "edge case",
            "validate",
            "validation",
            "verify",
            "test",
            "measure",
            "metric",
            "outcome",
            "result",
            "accessibility",
            "api",
            "database",
            "state",
            "component",
            "debug",
            "monitor",
            "error",
            "user",
            "requirement",
            "constraint",
            "security",
            "performance",
        ]

    def _practice_missing_points_for_answer(self, question: str, role: str, answer: str) -> list[str]:
        diagnostics = self._practice_answer_diagnostics(question, role, answer)
        if diagnostics["starts_with_model_answer"]:
            return ["Sharper measurable impact", "One explicit trade-off", "Short closing lesson"]
        if diagnostics["gibberish"] or not diagnostics["related"]:
            return ["Answer related to the prompt", "Role-specific details", "Concrete example"]
        if int(diagnostics["word_count"]) < 30:
            return ["200-250 word explanation", "Concrete steps", "Outcome or validation"]
        if int(diagnostics["word_count"]) < 120:
            return ["More depth", "Trade-offs or edge cases", "Measurable result"]
        if int(diagnostics["marker_hits"]) < 4:
            return ["Specific implementation detail", "Validation approach", "Clear result"]
        return ["Sharper trade-off", "Measurable impact", "Stronger closing lesson"]

    def _practice_improvement_tips_for_answer(self, question: str, role: str, answer: str) -> list[str]:
        diagnostics = self._practice_answer_diagnostics(question, role, answer)
        if diagnostics["starts_with_model_answer"]:
            return [
                "Keep this structure: goal, implementation, example, accessibility or validation, result.",
                "Add one measurable impact if you have real experience.",
                "Close with what you would improve next.",
            ]
        if diagnostics["gibberish"] or not diagnostics["related"]:
            return [
                "Please answer the actual question instead of typing unrelated text.",
                f"Mention the {role} context and use words from the prompt.",
                "Give one real or realistic example with action and result.",
            ]
        if int(diagnostics["word_count"]) < 30:
            return [
                "Expand this into at least 200-250 words for practice mode.",
                "Use this order: situation, approach, steps, trade-off, result.",
                "Add one concrete tool, decision, or measurable outcome.",
            ]
        if int(diagnostics["word_count"]) < 120:
            return [
                "Add more detail before moving to the result.",
                "Explain why you chose that approach over an alternative.",
                "Name how you would validate success.",
            ]
        return [
            "Make the example more role-specific.",
            "Add one trade-off, edge case, or failure mode.",
            "End with the business or user impact.",
        ]

    def _practice_final_feedback_for_answer(self, question: str, role: str, answer: str, score: float) -> str:
        diagnostics = self._practice_answer_diagnostics(question, role, answer)
        if diagnostics["starts_with_model_answer"] and score >= 8:
            return "This is a strong practice answer because it directly addresses the prompt, gives concrete implementation details, and explains how the approach would be validated."
        if diagnostics["gibberish"] or not diagnostics["related"]:
            return "Please answer related to the question. This response does not connect to the role, prompt, or expected topic, so it cannot receive a passing score."
        if int(diagnostics["word_count"]) < 30:
            return "This is related but too short to evaluate properly. In Practice Mode, aim for at least 200-250 words with a concrete example, steps, reasoning, and outcome."
        if int(diagnostics["word_count"]) < 120:
            return "This has some relevance, but it is still underdeveloped. Add enough detail to show the exact approach, trade-offs, validation, and result."
        if score < 7:
            return "The answer is on-topic, but it still lacks enough concrete implementation detail or measurable outcome to clear the practice round."
        return "This is a strong practice answer because it stays on-topic, explains concrete actions, and gives enough reasoning to support the score."

    def _enforce_practice_feedback_rules(
        self,
        feedback: RoundFeedback,
        question: str,
        role: str,
        answer: str,
        topic: str,
    ) -> RoundFeedback:
        normalized = " ".join(answer.split())
        word_count = len(normalized.split())
        score = float(feedback.score)
        diagnostics = self._practice_answer_diagnostics(question, role, answer)
        strong_floor = self._practice_strong_answer_floor(question, role, answer)

        if word_count < 10:
            score = 2.0 if diagnostics["related"] else (0.0 if word_count <= 2 else 1.0)
        else:
            if strong_floor is not None:
                score = max(score, strong_floor)
            elif diagnostics["gibberish"]:
                score = min(score, 1.0)
            elif not diagnostics["related"]:
                score = min(score, 2.0)
            elif word_count < 30:
                score = min(score, 4.0)
            elif word_count < 80:
                score = min(score, 5.5)
            elif word_count < 150:
                score = min(score, 6.8)
            elif int(diagnostics["marker_hits"]) < 4:
                score = min(score, 6.8)
        score = round(max(0, min(10, score)), 1)

        if score <= 3:
            verdict: Literal["fail", "average", "good", "excellent"] = "fail"
            level: Literal["easy", "medium", "hard"] = "easy"
        elif score <= 6:
            verdict = "average"
            level = "easy" if score < 5 else "medium"
        elif score <= 8:
            verdict = "good"
            level = "hard" if score >= 7.5 else "medium"
        else:
            verdict = "excellent"
            level = "hard"

        hint = feedback.hint
        if word_count < 10 and not hint:
            hint = "Use STAR: situation, task, action, result. Add one concrete detail."

        ideal_answer = (feedback.ideal_answer or "").strip() or f"A stronger {role} answer would clearly explain the situation, your decision process, the exact action you took, and the result."
        missing_points = self._practice_missing_points_for_answer(question, role, answer)
        improvement_tips = self._practice_improvement_tips_for_answer(question, role, answer)

        follow_up_question = feedback.follow_up_question
        if not follow_up_question:
            if score <= 4:
                follow_up_question = f"Let's simplify it. Give one short real example related to {topic} and explain what you did."
            elif score <= 6:
                follow_up_question = f"Go one layer deeper on {topic}. What trade-off or decision point did you handle?"
            else:
                follow_up_question = f"Now take {topic} one level further. What would you optimize, challenge, or improve in that approach?"

        final_feedback = self._practice_final_feedback_for_answer(question, role, answer, score)
        return RoundFeedback(
            score=score,
            verdict=verdict,
            strengths=(["The response was submitted, so the gap is visible.", "There is a clear opportunity to reset with an on-topic answer."] if diagnostics["gibberish"] or not diagnostics["related"] else list(feedback.strengths[:2]) or ["There is enough here to coach.", "The answer gives some signal about your current level."]),
            weaknesses=(["The answer is not related to the prompt.", "It does not show role-specific understanding or usable reasoning."] if diagnostics["gibberish"] or not diagnostics["related"] else list(feedback.weaknesses[:2]) or ["The answer lacks enough depth.", "The structure is not working yet."]),
            improvements=improvement_tips[:2],
            final_feedback=final_feedback,
            next_action="next_phase",
            next_phase=None,
            follow_up_question=follow_up_question,
            hint=hint,
            ideal_answer=ideal_answer,
            missing_points=missing_points,
            improvement_tips=improvement_tips,
            level=feedback.level or level,
            next_focus_area=(feedback.next_focus_area or topic).strip(),
        )

    def _practice_strong_answer_floor(self, question: str, role: str, answer: str) -> float | None:
        normalized = " ".join(answer.split())
        word_count = len(normalized.split())
        if self._is_app_model_hint_answer(question, role, answer):
            return 9.0 if word_count >= 90 else 8.4
        if word_count < 70:
            return None

        answer_lower = normalized.casefold()
        question_tokens = set(self._meaningful_tokens(question))
        answer_tokens = set(self._meaningful_tokens(answer))
        role_tokens = set(self._meaningful_tokens(role))
        overlap = len(question_tokens & answer_tokens)
        role_overlap = len(role_tokens & answer_tokens)
        quality_markers = [
            "for example",
            "because",
            "tradeoff",
            "trade-off",
            "edge case",
            "validate",
            "validation",
            "test",
            "accessibility",
            "aria",
            "keyboard",
            "screen reader",
            "loading",
            "disabled",
            "props",
            "class",
            "component",
            "api",
            "endpoint",
            "database",
            "schema",
            "index",
            "constraint",
            "permission",
            "error",
            "logging",
            "metrics",
            "outcome",
        ]
        marker_hits = sum(1 for marker in quality_markers if marker in answer_lower)

        if overlap >= 3 and marker_hits >= 4:
            return 8.8 if word_count >= 110 else 8.4
        if (overlap >= 2 or role_overlap >= 1) and marker_hits >= 4 and "for example" in answer_lower:
            return 8.5
        if overlap >= 2 and marker_hits >= 3 and any(term in answer_lower for term in ["test", "validate", "validation"]):
            return 8.0
        return None

    def _enforce_rapid_fire_feedback_rules(
        self,
        feedback: RoundFeedback,
        question: str,
        role: str,
        answer: str,
        voice_metrics: VoiceMetrics | None,
    ) -> RoundFeedback:
        normalized = " ".join(answer.split())
        word_count = len(normalized.split())
        score = float(feedback.score)
        if self._is_trivially_inadequate_answer(answer):
            score = min(score, 1.0)
        elif word_count < 10:
            score = 2.0 if self._is_related_short_answer(question, role, answer) else min(score, 1.0)

        clarity_bonus = 0.0
        if voice_metrics:
            if (voice_metrics.transcript_confidence or 0) >= 0.85:
                clarity_bonus += 0.3
            elif (voice_metrics.transcript_confidence or 0) < 0.5:
                clarity_bonus -= 0.3
            if (voice_metrics.average_volume or 0) > 0.6:
                clarity_bonus += 0.2

        score = round(max(0, min(10, score + clarity_bonus)), 1)

        if score <= 3:
            verdict: Literal["fail", "average", "good", "excellent"] = "fail"
        elif score <= 6:
            verdict = "average"
        elif score <= 8:
            verdict = "good"
        else:
            verdict = "excellent"

        expected_answer = (feedback.expected_answer or "").strip() or f"A concise correct explanation of the concept behind '{question}' for a {role}."
        explanation = (feedback.explanation or "").strip() or "Direct answer required. Define the concept clearly and stop."
        strengths = list(feedback.strengths[:2]) or ["The answer addresses the prompt.", "There is enough substance to score the response."]
        weaknesses = list(feedback.weaknesses[:2]) or ["The recall was not sharp enough.", "The response needs more precision."]
        improvements = list(feedback.improvements[:2]) or ["Answer with one clear definition.", "Avoid filler and get to the point."]
        final_feedback = (feedback.final_feedback or "").strip() or "Rapid fire answer assessed."

        return RoundFeedback(
            question=question,
            score=score,
            verdict=verdict,
            correct=score >= 6,
            expected_answer=expected_answer,
            explanation=explanation,
            strengths=strengths,
            weaknesses=weaknesses,
            improvements=improvements,
            final_feedback=final_feedback,
            next_action="complete",
            next_phase=None,
            follow_up_question=None,
            hint=None,
            ideal_answer=None,
            missing_points=[],
            improvement_tips=[],
            level=None,
            next_focus_area=None,
            progress=feedback.progress,
        )

    def _list_text(self, items: list[str] | None) -> str:
        if not items:
            return "None provided."
        return ", ".join(item.strip() for item in items if item.strip()) or "None provided."

    def _enforce_report_rules(
        self,
        report: FinalReport,
        session_id: str,
        role: str,
        history: list[HistoryItem],
    ) -> FinalReport:
        scores = [item.feedback.score for item in history if item.feedback]
        if not scores:
            return report

        average_score = round(sum(scores) / len(scores), 1)
        trivial_answers = sum(1 for item in history if self._is_trivially_inadequate_answer(item.answer or ""))
        failed_interview = average_score < 4 or trivial_answers >= 1
        is_rapid_fire = len(history) == 10 and all(item.round == InterviewRound.FINAL for item in history)
        accuracy = round((sum(1 for item in history if item.feedback and item.feedback.correct) / len(history)) * 100, 1) if is_rapid_fire and history else report.accuracy
        speed_rating = report.speed_rating if is_rapid_fire else None
        final_verdict = "fail" if average_score <= 3 else "average" if average_score <= 6 else "good" if average_score <= 8 else "excellent"

        if failed_interview:
            return FinalReport(
                session_id=session_id,
                role=role,
                overall_score=average_score,
                category_breakdown={
                    "Communication": average_score,
                    "Domain knowledge": average_score,
                    "Problem-solving": average_score,
                    "Confidence": average_score,
                },
                strengths=[
                    "You completed enough of the flow to be evaluated.",
                    "The weak spots are obvious rather than hidden.",
                    "The result is clear enough to guide the next attempt.",
                ],
                weak_topics=[
                    "Answer substance",
                    "Professional communication",
                    "Role-specific depth",
                ],
                improvement_roadmap=[
                    "Stop giving joke, filler, or one-word answers.",
                    "Use concrete examples with actions and results.",
                    "Review the basics of the role before trying again.",
                    "Practice full spoken or written answers under time pressure.",
                ],
                accuracy=accuracy,
                speed_rating=speed_rating,
                final_verdict="fail",
                recommendation="Your rapid recall and accuracy are not strong enough yet." if is_rapid_fire else None,
            )

        return FinalReport(
            session_id=session_id,
            role=role,
            overall_score=average_score,
            category_breakdown=self._normalized_breakdown(report.category_breakdown, average_score),
            strengths=report.strengths[:3],
            weak_topics=report.weak_topics[:3],
            improvement_roadmap=report.improvement_roadmap[:4],
            accuracy=accuracy,
            speed_rating=speed_rating,
            final_verdict=report.final_verdict or final_verdict,
            recommendation=report.recommendation if is_rapid_fire else None,
        )

    def _normalized_breakdown(self, breakdown: dict[str, float], average_score: float) -> dict[str, float]:
        normalized = {
            "Communication": breakdown.get("Communication", average_score),
            "Domain knowledge": breakdown.get("Domain knowledge", average_score),
            "Problem-solving": breakdown.get("Problem-solving", average_score),
            "Confidence": breakdown.get("Confidence", average_score),
        }
        return {key: round(min(float(value), average_score + 0.5), 1) for key, value in normalized.items()}

    def _is_related_short_answer(self, question: str, role: str, answer: str) -> bool:
        answer_tokens = self._meaningful_tokens(answer)
        if not answer_tokens:
            return False

        context_tokens = self._meaningful_tokens(question) | self._meaningful_tokens(role)
        overlap = answer_tokens & context_tokens
        if overlap:
            return True

        reasoning_markers = {"because", "using", "with", "through", "by", "after", "before", "while"}
        return bool(answer_tokens & reasoning_markers)

    def _average_voice_confidence(self, history: list[HistoryItem]) -> float:
        del history
        return 0.6

    def _meaningful_tokens(self, text: str) -> set[str]:
        stopwords = {
            "the", "and", "for", "with", "that", "this", "from", "into", "your", "about", "have", "when",
            "what", "would", "could", "should", "tell", "time", "role", "position", "interview", "round",
            "mock", "practice", "rapid", "fire", "they", "them", "their", "then", "than", "just", "also",
            "did", "was", "were", "are", "you", "use", "used", "had", "has", "how", "why", "can",
        }
        cleaned = []
        for raw in text.casefold().replace("/", " ").replace("-", " ").split():
            token = "".join(ch for ch in raw if ch.isalnum())
            if len(token) < 3 or token in stopwords:
                continue
            cleaned.append(token)
        return set(cleaned)

    def _resume_keywords_for_role(self, target_role: str) -> list[str]:
        role = target_role.casefold()
        if "frontend" in role or "web developer" in role or "react" in role:
            return ["React", "JavaScript", "TypeScript", "HTML", "CSS", "Redux", "API integration", "responsive design"]
        if "backend" in role or "api" in role:
            return ["API", "Python", "Node.js", "SQL", "PostgreSQL", "authentication", "microservices", "performance"]
        if "data" in role or "analyst" in role or "power bi" in role:
            return ["SQL", "Excel", "Power BI", "dashboarding", "ETL", "data visualization", "reporting", "analysis"]
        if "product" in role:
            return ["roadmap", "stakeholders", "metrics", "prioritization", "experimentation", "user research", "analytics"]
        if "sales" in role:
            return ["pipeline", "CRM", "lead generation", "closing", "forecasting", "negotiation", "revenue"]
        if "devops" in role or "cloud" in role:
            return ["AWS", "CI/CD", "Docker", "Kubernetes", "monitoring", "automation", "infrastructure as code"]
        return ["communication", "problem solving", "project delivery", "stakeholder management", "analysis", "tools", "results"]

    def _resume_verdict_for_score(self, score: float) -> Literal["poor", "average", "good", "strong", "excellent"]:
        if score < 40:
            return "poor"
        if score < 60:
            return "average"
        if score < 75:
            return "good"
        if score < 90:
            return "strong"
        return "excellent"

    def _line_looks_weak(self, line: str) -> bool:
        weak_phrases = ("worked on", "responsible for", "helped with", "involved in", "participated in")
        lowered = line.casefold()
        return any(phrase in lowered for phrase in weak_phrases) or not any(ch.isdigit() for ch in line)

    def _improved_resume_bullet(self, original: str, target_role: str) -> str:
        stripped = original.lstrip("-*• ").strip()
        if not stripped:
            return f"Delivered {target_role}-relevant work with measurable outcomes, stronger ownership, and clearly named tools."
        return (
            f"Led {stripped.lower()} using role-relevant tools, improved delivery quality, and produced measurable results such as faster turnaround, better accuracy, or stronger user impact."
        )

    def _enforce_resume_analysis_rules(
        self,
        analysis: ResumeAnalysisResponse,
        target_role: str,
        resume_text: str,
    ) -> ResumeAnalysisResponse:
        fallback = self._fallback_resume_analysis(target_role, resume_text)
        score = max(0.0, min(100.0, float(analysis.ats_score)))
        if len(resume_text.split()) < 120:
            score = min(score, max(fallback.ats_score, 58.0))

        missing_keywords = analysis.missing_keywords[:8] or fallback.missing_keywords
        strengths = analysis.strengths[:3] or fallback.strengths
        weaknesses = analysis.weaknesses[:4] or fallback.weaknesses
        improvements = analysis.improvements[:4] or fallback.improvements
        rewritten_examples = analysis.rewritten_examples[:2] or fallback.rewritten_examples
        verdict = self._resume_verdict_for_score(score)
        final_feedback = analysis.final_feedback.strip() or fallback.final_feedback

        return ResumeAnalysisResponse(
            ats_score=round(score, 1),
            verdict=verdict,
            missing_keywords=missing_keywords,
            strengths=strengths,
            weaknesses=weaknesses,
            improvements=improvements,
            rewritten_examples=rewritten_examples,
            final_feedback=final_feedback,
        )
