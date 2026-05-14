export type InterviewRound = "Intro" | "Behavioral" | "Domain" | "Final" | "Feedback Report";
export type InterviewState = "active" | "completed";
export type InterviewMode = "Mock Interview" | "Practice Mode" | "Rapid Fire Mode";

export type RoundFeedback = {
  question?: string | null;
  score: number;
  verdict?: "fail" | "average" | "good" | "excellent";
  correct?: boolean | null;
  expected_answer?: string | null;
  explanation?: string | null;
  strengths: string[];
  weaknesses: string[];
  improvements?: string[];
  final_feedback?: string;
  next_action?: "stop" | "next_phase" | "complete";
  next_phase?: "practice" | "mock" | "rapid_fire" | null;
  follow_up_question?: string | null;
  next_question?: string | null;
  hint?: string | null;
  ideal_answer?: string | null;
  missing_points?: string[];
  improvement_tips?: string[];
  level?: "easy" | "medium" | "hard" | null;
  next_focus_area?: string | null;
  progress?: string | null;
};

export type HistoryItem = {
  round: InterviewRound;
  question: string;
  answer?: string | null;
  feedback?: RoundFeedback | null;
};

export type InterviewSession = {
  id: string;
  role: string;
  difficulty: string;
  mode: InterviewMode | string;
  total_questions?: number;
  current_round: InterviewRound;
  current_question: string;
  history: HistoryItem[];
  scores: Record<string, number>;
  state: InterviewState;
};

export type FinalReport = {
  session_id: string;
  role: string;
  overall_score: number;
  category_breakdown: Record<string, number>;
  strengths: string[];
  weak_topics: string[];
  improvement_roadmap: string[];
};

export type RewrittenExample = {
  original: string;
  improved: string;
};

export type ResumeAnalysis = {
  ats_score: number;
  verdict: "poor" | "average" | "good" | "strong" | "excellent";
  missing_keywords: string[];
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  rewritten_examples: RewrittenExample[];
  final_feedback: string;
};

export type ProgressSummary = {
  total_interviews: number;
  average_score: number;
  mode_unlocks?: Record<InterviewMode, boolean>;
  recommended_next_mode?: InterviewMode | null;
  difficulty_unlocks?: Record<string, boolean>;
  recommended_difficulty?: string | null;
  difficulty_phase_status?: Record<string, Record<InterviewMode, boolean>>;
  score_trends: Array<{ session_id: string; role: string; score: number | string }>;
  weak_topics: string[];
  recent_sessions: InterviewSession[];
};
