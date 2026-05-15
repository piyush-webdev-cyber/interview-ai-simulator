import type { FinalReport, InterviewSession, ProgressSummary, ResumeAnalysis, RoundFeedback } from "@/types/interview";
import { supabase } from "@/lib/supabase";

const DEPLOYED_API_URL = "https://interview-ai-simulator-r685.onrender.com";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function resolveApiUrls(): string[] {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return [stripTrailingSlash(process.env.EXPO_PUBLIC_API_URL)];
  }

  return [DEPLOYED_API_URL];
}

const API_URLS = resolveApiUrls();

type ApiErrorPayload = {
  detail?: string;
};

async function authHeaders(options?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  let session = data.session;

  const expiresAtMs = session?.expires_at ? session.expires_at * 1000 : 0;
  const shouldRefresh = Boolean(session?.refresh_token && expiresAtMs && expiresAtMs - Date.now() < 60_000);

  if (shouldRefresh) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data.session ?? session;
  }

  const token = session?.access_token;

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options?.headers,
  };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let lastNetworkError = "Network request failed";
  let response: Response | null = null;
  const headers = await authHeaders(options);

  for (const apiUrl of API_URLS) {
    try {
      response = await fetch(`${apiUrl}${path}`, {
        headers,
        ...options
      });
      break;
    } catch (error) {
      lastNetworkError = error instanceof Error ? error.message : "Network request failed";
    }
  }

  if (!response) {
    throw new Error(`${lastNetworkError}. Backend URLs tried: ${API_URLS.join(", ")}`);
  }

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const body = (await response.json()) as ApiErrorPayload;
      if (body.detail) message = body.detail;
    } catch {
      const detail = await response.text();
      if (detail) message = detail;
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export const api = {
  suggestRoles: (query: string) =>
    request<{ suggestions: string[] }>(`/suggest-roles?query=${encodeURIComponent(query)}`),
  startInterview: (payload: { role: string; difficulty: string; mode: string }) =>
    request<{ session: InterviewSession }>("/start-interview", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  submitAnswer: (payload: { session_id: string; answer: string }) =>
    request<{ session: InterviewSession; feedback: RoundFeedback; is_completed: boolean }>("/submit-answer", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  getFeedback: (sessionId: string) => request<FinalReport>(`/feedback/${sessionId}`),
  getProgress: () => request<ProgressSummary>("/progress"),
  analyzeResumeFile: (payload: { target_role: string; file_name: string; file_base64: string; file_mime_type?: string | null }) =>
    request<ResumeAnalysis>("/analyze-resume-file", {
      method: "POST",
      body: JSON.stringify(payload)
    })
};

