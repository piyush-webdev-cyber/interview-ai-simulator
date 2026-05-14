import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { api } from "@/api/client";
import type { FinalReport, InterviewSession, ProgressSummary, ResumeAnalysis, RoundFeedback } from "@/types/interview";

type InterviewStore = {
  session: InterviewSession | null;
  latestFeedback: RoundFeedback | null;
  finalReport: FinalReport | null;
  progress: ProgressSummary | null;
  resumeAnalysis: ResumeAnalysis | null;
  loading: boolean;
  error: string | null;
  startInterview: (role: string, difficulty: string, mode: string) => Promise<boolean>;
  restartInterview: () => Promise<boolean>;
  submitAnswer: (answer: string) => Promise<boolean>;
  loadFeedback: () => Promise<void>;
  loadProgress: () => Promise<void>;
  analyzeResumeFile: (payload: { target_role: string; file_name: string; file_base64: string; file_mime_type?: string | null }) => Promise<void>;
  clearActiveSession: () => void;
  clearError: () => void;
};

export const useInterviewStore = create<InterviewStore>()(
  persist(
    (set, get) => ({
      session: null,
      latestFeedback: null,
      finalReport: null,
      progress: null,
      resumeAnalysis: null,
      loading: false,
      error: null,
      startInterview: async (role, difficulty, mode) => {
        set({ loading: true, error: null, latestFeedback: null, finalReport: null });
        try {
          const { session } = await api.startInterview({ role, difficulty, mode });
          set({ session, loading: false });
          return true;
        } catch (error) {
          set({ error: error instanceof Error ? error.message : "Could not start interview", loading: false });
          return false;
        }
      },
      restartInterview: async () => {
        const session = get().session;
        if (!session) return false;
        return get().startInterview(session.role, session.difficulty, session.mode);
      },
      submitAnswer: async (answer) => {
        const session = get().session;
        if (!session) return false;
        set({ loading: true, error: null });
        try {
          const response = await api.submitAnswer({ session_id: session.id, answer });
          set({ session: response.session, latestFeedback: response.feedback, loading: false });
          return response.is_completed;
        } catch (error) {
          set({ error: error instanceof Error ? error.message : "Could not submit answer", loading: false });
          return false;
        }
      },
      loadFeedback: async () => {
        const session = get().session;
        if (!session) return;
        set({ loading: true, error: null });
        try {
          const finalReport = await api.getFeedback(session.id);
          set({ finalReport, loading: false });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : "Could not load feedback", loading: false });
        }
      },
      loadProgress: async () => {
        set({ loading: true, error: null });
        try {
          const progress = await api.getProgress();
          set({ progress, loading: false });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : "Could not load progress", loading: false });
        }
      },
      analyzeResumeFile: async (payload) => {
        set({ loading: true, error: null, resumeAnalysis: null });
        try {
          const resumeAnalysis = await api.analyzeResumeFile(payload);
          set({ resumeAnalysis, loading: false });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : "Could not analyze resume", loading: false });
        }
      },
      clearActiveSession: () => set({ session: null, latestFeedback: null, finalReport: null, error: null }),
      clearError: () => set({ error: null })
    }),
    {
      name: "interview-ai-session",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        session: state.session,
        latestFeedback: state.latestFeedback,
        finalReport: state.finalReport,
        resumeAnalysis: state.resumeAnalysis,
      }),
    },
  ),
);

