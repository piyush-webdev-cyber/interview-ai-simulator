import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { AppState } from "react-native";
import { createClient } from "@supabase/supabase-js";

WebBrowser.maybeCompleteAuthSession();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://brgtoqzsyxincrimlopa.supabase.co";
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyZ3RvcXpzeXhpbmNyaW1sb3BhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NTU2MTgsImV4cCI6MjA5MzIzMTYxOH0.uVbjvlAvz0xrdWY7GRttkDGA_UFYm3nnMsSH__tSCJ8";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const supabaseRedirectUrl = makeRedirectUri({
  scheme: "interviewai",
  path: "auth/callback",
});

const oauthTimeoutMs = 120000;
const oauthReturnGraceMs = 5000;
const sessionPollMs = 350;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseAuthCallbackUrl(url: string) {
  const normalizedUrl = url.includes("#") ? url.replace("#", "?") : url;
  const parsed = Linking.parse(normalizedUrl);
  const accessToken = firstString(parsed.queryParams?.access_token);
  const refreshToken = firstString(parsed.queryParams?.refresh_token);
  const code = firstString(parsed.queryParams?.code);
  const errorDescription = firstString(parsed.queryParams?.error_description) ?? firstString(parsed.queryParams?.error);

  return { accessToken, refreshToken, code, errorDescription };
}

function isSupabaseAuthCallback(url: string) {
  return url.startsWith(supabaseRedirectUrl);
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForSupabaseSession(timeoutMs = oauthReturnGraceMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session) return data.session;
    await wait(sessionPollMs);
  }

  return null;
}

function waitForSupabaseAuthCallback(timeoutMs = oauthTimeoutMs) {
  let subscription: { remove: () => void } | null = null;
  let appStateSubscription: { remove: () => void } | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const promise = new Promise<string>((resolve, reject) => {
    const finish = (url: string) => {
      if (isSupabaseAuthCallback(url)) {
        resolve(url);
      }
    };

    subscription = Linking.addEventListener("url", ({ url }) => finish(url));
    Linking.getInitialURL()
      .then((url) => {
        if (url) finish(url);
      })
      .catch(() => {
        // The live Linking event above is the primary callback path.
      });
    appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        Linking.getInitialURL()
          .then((url) => {
            if (url) finish(url);
          })
          .catch(() => {
            // Session polling covers cases where App.tsx already consumed the link.
          });
      }
    });

    timeout = setTimeout(() => {
      reject(
        new Error(
          `Google sign-in did not return to the app. Supabase must allow this exact redirect URL: ${supabaseRedirectUrl}`,
        ),
      );
    }, timeoutMs);
  });

  return {
    promise,
    cleanup: () => {
      subscription?.remove();
      appStateSubscription?.remove();
      if (timeout) clearTimeout(timeout);
    },
  };
}

export async function completeSupabaseSessionFromUrl(url: string) {
  const { accessToken, refreshToken, code, errorDescription } = parseAuthCallbackUrl(url);

  if (errorDescription) throw new Error(errorDescription);

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }

  if (!accessToken || !refreshToken) return false;

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) throw error;
  return true;
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: supabaseRedirectUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error("Supabase did not return a Google sign-in URL.");

  const callback = waitForSupabaseAuthCallback();

  try {
    const browserResultPromise = WebBrowser.openBrowserAsync(data.url);
    const callbackOrSession = await Promise.race([
      callback.promise.then(async (callbackUrl) => {
        await completeSupabaseSessionFromUrl(callbackUrl);
        return waitForSupabaseSession(oauthReturnGraceMs);
      }),
      browserResultPromise.then(() => waitForSupabaseSession(oauthReturnGraceMs)),
    ]);

    const session = callbackOrSession ?? (await waitForSupabaseSession(oauthReturnGraceMs));
    if (!session) {
      throw new Error("Google sign-in returned to the app, but Supabase did not create a session.");
    }
    return supabase.auth.getSession();
  } finally {
    callback.cleanup();
    WebBrowser.dismissBrowser();
  }
}
