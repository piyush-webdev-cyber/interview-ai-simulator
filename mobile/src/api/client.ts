import type { FinalReport, InterviewSession, ProgressSummary, ResumeAnalysis, RoundFeedback } from "@/types/interview";
import Constants from "expo-constants";
import { NativeModules, Platform } from "react-native";
import { supabase } from "@/lib/supabase";

const DEFAULT_BACKEND_PORT = process.env.EXPO_PUBLIC_API_PORT ?? "8012";
const KNOWN_LAN_HOSTS = ["10.48.61.203"];

type ExpoConstantsWithHost = typeof Constants & {
  manifest?: { debuggerHost?: string; packagerOpts?: { host?: string } };
  manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
};

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeHost(value?: string | null): string | null {
  if (!value) return null;
  return value.replace(/^https?:\/\//, "").split("/")[0].split(":")[0] || null;
}

function getExpoHost(): string | null {
  const constants = Constants as ExpoConstantsWithHost;
  const hostUri =
    Constants.expoConfig?.hostUri ??
    constants.manifest2?.extra?.expoClient?.hostUri ??
    constants.manifest?.debuggerHost ??
    constants.manifest?.packagerOpts?.host;

  return normalizeHost(hostUri);
}

function getMetroScriptHost(): string | null {
  const sourceCode = NativeModules.SourceCode as { scriptURL?: string } | undefined;
  return normalizeHost(sourceCode?.scriptURL);
}

function unique(values: string[]) {
  return [...new Set(values.map(stripTrailingSlash).filter(Boolean))];
}

function resolveApiUrls(): string[] {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return [stripTrailingSlash(process.env.EXPO_PUBLIC_API_URL)];
  }

  const urls: string[] = [];
  const expoHost = getExpoHost();
  if (expoHost) {
    urls.push(`http://${expoHost}:${DEFAULT_BACKEND_PORT}`);
  }

  const metroScriptHost = getMetroScriptHost();
  if (metroScriptHost) {
    urls.push(`http://${metroScriptHost}:${DEFAULT_BACKEND_PORT}`);
  }

  for (const host of KNOWN_LAN_HOSTS) {
    urls.push(`http://${host}:${DEFAULT_BACKEND_PORT}`);
  }

  if (Platform.OS === "android") {
    urls.push(`http://127.0.0.1:${DEFAULT_BACKEND_PORT}`);
    urls.push(`http://10.0.2.2:${DEFAULT_BACKEND_PORT}`);
  } else {
    urls.push(`http://localhost:${DEFAULT_BACKEND_PORT}`);
  }

  return unique(urls);
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

