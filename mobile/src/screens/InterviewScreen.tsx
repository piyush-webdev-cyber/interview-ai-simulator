import { Lightbulb, Mic, SendHorizonal } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Screen } from "@/components/Screen";
import { useInterviewStore } from "@/store/interviewStore";
import { colors } from "@/theme";

type Props = {
  navigation: any;
};
type SpeechRecognitionModule = typeof import("expo-speech-recognition")["ExpoSpeechRecognitionModule"];
type SpeechRecognitionSubscription = {
  remove: () => void;
};

const ROUNDS = ["Behavioral", "Domain", "Final"];
const MAX_HINTS_PER_SESSION = 2;

function cleanQuestion(question: string) {
  return question.replace(/\s+/g, " ").replace(/^["']|["']$/g, "").trim();
}

function buildMockHint(question: string, role: string, round: string) {
  const cleaned = cleanQuestion(question);
  const lower = cleaned.toLowerCase();
  const roleLabel = role || "this role";

  if (round === "Behavioral" || lower.includes("describe a situation") || lower.includes("tell me about")) {
    return {
      answer: `I would answer it like this: In one project, I had to handle a situation directly related to "${cleaned}". The context was that the team needed a clear outcome, but the information was messy and different stakeholders understood it differently. My task was to turn that ambiguity into something actionable. I first clarified the audience, success criteria, constraints, and deadline. Then I broke the work into steps, gathered the missing details, created a simple draft or plan, reviewed it with the right people, and revised it based on feedback. The result was a clearer deliverable, fewer misunderstandings, and a process the team could reuse. What I learned was to confirm the audience and acceptance criteria early, because that prevents rework later.`,
      explanation:
        "This works because it uses a complete STAR structure: situation, task, action, result, and lesson. It gives a concrete process and a measurable impact instead of giving a generic personality answer.",
    };
  }

  if (lower.includes("technical information") || lower.includes("manual") || lower.includes("document")) {
    return {
      answer:
        "I would answer it like this: In a documentation project, I had to turn a complex technical workflow into a user manual for non-engineering users. I started by identifying the audience, their goals, and the tasks they needed to complete. Then I interviewed the engineers, tested the workflow myself, and converted the information into step-by-step instructions with screenshots, warnings, and troubleshooting notes. I avoided internal jargon and used task-based headings like 'Create a report' instead of system-focused headings. To validate it, I asked a new user to follow the guide without help and noted where they got stuck. After revising those sections, support questions dropped and users could complete the workflow faster.",
      explanation:
        "This should score highly because it gives a realistic Technical Writer example, explains the exact documentation process, includes validation with real users, and ends with a clear result.",
    };
  }

  if (round === "Domain" || lower.includes("how would you")) {
    return {
      answer: `I would answer it like this: For a ${roleLabel} role, I would approach this by first clarifying the goal, user, constraints, and definition of done. Then I would break the work into concrete steps: gather requirements, identify risks, create the first version, review it with stakeholders, test it against real scenarios, and iterate. For example, if the task was "${cleaned}", I would define what a successful output looks like, produce a draft or implementation, validate it with the intended audience, and track issues found during review. The key tradeoff is speed versus accuracy, so I would deliver a usable first version quickly while protecting correctness with review and testing.`,
      explanation:
        "This works because it answers the question with a practical workflow, a concrete example, tradeoff awareness, and validation. It shows how the candidate thinks on the job.",
    };
  }

  return {
    answer: `I would answer it like this: The question is asking how I would handle "${cleaned}" as a ${roleLabel}. I would start by restating the goal, then give a specific example, explain the action I took, and finish with the result. My answer would include the constraints, the decisions I made, the tradeoffs I considered, and how I measured success. That makes the response clear, realistic, and easy for the interviewer to evaluate.`,
    explanation:
      "This works because it directly addresses the prompt, adds structure, includes example-based reasoning, and avoids vague claims.",
  };
}

export function InterviewScreen({ navigation }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const speechModuleRef = useRef<SpeechRecognitionModule | null>(null);
  const speechSubscriptionsRef = useRef<SpeechRecognitionSubscription[]>([]);
  const [answer, setAnswer] = useState("");
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintedQuestionKeys, setHintedQuestionKeys] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [speechStatus, setSpeechStatus] = useState("Tap the mic to dictate your answer.");
  const { session, latestFeedback, submitAnswer, loading, error } = useInterviewStore();

  const progress = useMemo(() => {
    if (!session) return 0;
    const index = Math.max(0, ROUNDS.indexOf(session.current_round));
    return session.state === "completed" ? 1 : (index + 1) / ROUNDS.length;
  }, [session]);
  const currentQuestionKey = `${session?.id ?? ""}:${session?.current_round ?? ""}:${session?.current_question ?? ""}`;
  const remainingHints = Math.max(MAX_HINTS_PER_SESSION - hintsUsed, 0);
  const isCurrentQuestionHintRevealed = hintedQuestionKeys.includes(currentQuestionKey);
  const mockHint = useMemo(
    () => buildMockHint(session?.current_question ?? "", session?.role ?? "", session?.current_round ?? ""),
    [session?.current_question, session?.role, session?.current_round],
  );

  useEffect(() => {
    setHintsUsed(0);
    setHintedQuestionKeys([]);
  }, [session?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [session?.current_question]);

  useEffect(() => {
    return () => {
      speechSubscriptionsRef.current.forEach((subscription) => subscription.remove());
      speechSubscriptionsRef.current = [];
      speechModuleRef.current?.abort();
    };
  }, []);

  if (!session) {
    return (
      <Screen>
        <Text className="text-xl font-bold text-ink">No active interview</Text>
        <View className="mt-5">
          <PrimaryButton label="Choose a role" onPress={() => navigation.navigate("RoleSelection")} />
        </View>
      </Screen>
    );
  }

  const submit = async () => {
    if (!answer.trim()) return;
    if (isListening) {
      await stopListening();
    }
    const completed = await submitAnswer(answer.trim());
    setAnswer("");
    if (completed) navigation.replace("Feedback");
  };

  const appendTranscript = (transcript: string) => {
    const cleaned = transcript.trim();
    if (!cleaned) return;
    setAnswer((current) => {
      const trimmed = current.trim();
      if (!trimmed) return cleaned;
      if (trimmed.endsWith(cleaned)) return trimmed;
      return `${trimmed} ${cleaned}`;
    });
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const loadSpeechModule = async () => {
    if (speechModuleRef.current) return speechModuleRef.current;

    try {
      const module = await import("expo-speech-recognition");
      const speechModule = module.ExpoSpeechRecognitionModule;

      speechSubscriptionsRef.current = [
        speechModule.addListener("start", () => {
          setIsListening(true);
          setSpeechStatus("Listening...");
        }),
        speechModule.addListener("end", () => {
          setIsListening(false);
          setSpeechStatus("Speech captured. Tap mic again to add more.");
        }),
        speechModule.addListener("result", (event) => {
          appendTranscript(event.results[0]?.transcript ?? "");
        }),
        speechModule.addListener("error", (event) => {
          setIsListening(false);
          setSpeechStatus("Tap the mic to try again.");
          if (event.error !== "aborted") {
            Alert.alert("Speech input stopped", event.message || "Could not recognize speech. Try again.");
          }
        }),
      ];

      speechModuleRef.current = speechModule;
      return speechModule;
    } catch {
      Alert.alert(
        "Development build required",
        "Speech-to-text needs the custom Android build because Expo Go does not include the native speech module. The rest of the app will work in Expo Go.",
      );
      return null;
    }
  };

  const requestMicrophonePermission = async (speechModule: SpeechRecognitionModule) => {
    const result = await speechModule.requestPermissionsAsync();
    return result.granted;
  };

  const startListening = async () => {
    const speechModule = await loadSpeechModule();
    if (!speechModule) return;

    const hasPermission = await requestMicrophonePermission(speechModule);
    if (!hasPermission) {
      Alert.alert("Microphone blocked", "Allow microphone access to use speech-to-text.");
      return;
    }

    try {
      if (!speechModule.isRecognitionAvailable()) {
        Alert.alert("Speech recognition unavailable", "No speech recognition service is available on this device.");
        return;
      }

      speechModule.start({
        lang: "en-US",
        interimResults: true,
        continuous: false,
      });
    } catch (error) {
      setIsListening(false);
      setSpeechStatus("Tap the mic to try again.");
      Alert.alert("Speech input failed", error instanceof Error ? error.message : "Could not start speech recognition.");
    }
  };

  const stopListening = async () => {
    const speechModule = speechModuleRef.current;
    if (!speechModule) return;
    try {
      speechModule.stop();
    } finally {
      setIsListening(false);
      setSpeechStatus("Speech captured. Tap mic again to add more.");
    }
  };

  const toggleListening = async () => {
    if (isListening) {
      await stopListening();
      return;
    }
    await startListening();
  };

  const handleHintPress = () => {
    if (remainingHints <= 0) {
      Alert.alert("No hints left", "You have used all 2 hints for this mock interview.");
      return;
    }

    if (isCurrentQuestionHintRevealed) {
      Alert.alert("Hint already shown", "You already used a hint for this question. Save the remaining hint for another question.");
      return;
    }

    Alert.alert(
      "Use a hint?",
      `You have ${remainingHints} of ${MAX_HINTS_PER_SESSION} total hints left for this mock interview. Using this will spend 1 hint.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Use hint",
          onPress: () => {
            const nextHintsUsed = Math.min(hintsUsed + 1, MAX_HINTS_PER_SESSION);
            setHintsUsed(nextHintsUsed);
            setHintedQuestionKeys((keys) => (keys.includes(currentQuestionKey) ? keys : [...keys, currentQuestionKey]));
            if (nextHintsUsed === MAX_HINTS_PER_SESSION) {
              Alert.alert("All hints used", "You have used all 2 hints for this mock interview.");
            }
          },
        },
      ],
    );
  };

  return (
    <Screen scroll={false} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1" keyboardVerticalOffset={8}>
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-5 flex-row items-start justify-between">
            <View>
              <Text className="text-sm font-semibold uppercase tracking-wide text-muted">{session.role}</Text>
              <Text className="mt-1 text-2xl font-bold text-ink">{session.current_round} Round</Text>
            </View>
            <View className="items-end gap-2">
              <View className="items-center rounded-lg bg-blue-50 px-3 py-2">
                <Text className="text-xs font-semibold text-brand">{loading ? "Thinking" : "Listening"}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={handleHintPress}
                style={[styles.hintButton, remainingHints <= 0 && styles.hintButtonUsed]}
              >
                <View style={styles.hintIconWrap}>
                  <Lightbulb color={remainingHints <= 0 ? "#94A3B8" : "#D97706"} size={20} />
                  <View style={styles.hintBadge}>
                    <Text style={styles.hintBadgeText}>{remainingHints}</Text>
                  </View>
                </View>
                <Text style={[styles.hintButtonText, remainingHints <= 0 && styles.hintButtonTextUsed]}>
                  {remainingHints <= 0 ? "Used" : "Hint"}
                </Text>
              </Pressable>
            </View>
          </View>

          <View className="mb-6 h-2 rounded-full bg-slate-100">
            <View className="h-2 rounded-full bg-brand" style={{ width: `${progress * 100}%` }} />
          </View>

          <View className="mb-6">
            <Text className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Question</Text>
            <Text className="text-2xl font-bold leading-9 text-ink">{session.current_question}</Text>
            {isCurrentQuestionHintRevealed ? (
              <View style={styles.hintCard}>
                <View style={styles.hintCardHeader}>
                  <Lightbulb color="#D97706" size={18} />
                  <Text style={styles.hintCardTitle}>{`Hints left ${remainingHints}/${MAX_HINTS_PER_SESSION}`}</Text>
                </View>
                <View style={styles.hintBlock}>
                  <Text style={styles.hintTitle}>Model answer</Text>
                  <Text selectable style={styles.hintText}>{mockHint.answer}</Text>
                  <Text style={[styles.hintTitle, styles.hintTitleSecondary]}>Why this works</Text>
                  <Text selectable style={styles.hintText}>{mockHint.explanation}</Text>
                </View>
              </View>
            ) : null}
            {latestFeedback ? (
              <View className="mt-6 rounded-lg bg-panel p-4">
                <Text className="text-base font-bold text-ink">Previous round score: {latestFeedback.score.toFixed(1)}/10</Text>
                <Text className="mt-2 text-sm leading-5 text-muted">{latestFeedback.weaknesses[0]}</Text>
              </View>
            ) : null}
            {error ? <Text className="mt-4 text-sm text-red-600">{error}</Text> : null}
          </View>

          <View className="border-t border-slate-100 pt-4">
            <TextInput
              value={answer}
              onChangeText={setAnswer}
              onFocus={() => {
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
              }}
              placeholder="Type your answer..."
              placeholderTextColor="#94A3B8"
              multiline
              scrollEnabled
              textAlignVertical="top"
              style={styles.answerInput}
            />
            <View className="flex-row gap-3">
              <Pressable
                accessibilityRole="button"
                onPress={toggleListening}
                style={[styles.micButton, isListening && styles.micButtonActive]}
              >
                <Mic color={isListening ? "#FFFFFF" : "#94A3B8"} size={20} />
              </Pressable>
              <View className="flex-1">
                <PrimaryButton
                  label="Submit answer"
                  loading={loading}
                  disabled={!answer.trim()}
                  onPress={submit}
                  icon={<SendHorizonal color="white" size={18} />}
                />
              </View>
            </View>
            <Text className="mt-3 text-center text-xs text-muted">{speechStatus}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
  },
  hintButton: {
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  hintButtonUsed: {
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  hintIconWrap: {
    position: "relative",
  },
  hintBadge: {
    position: "absolute",
    top: -8,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  hintBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "900",
  },
  hintButtonText: {
    color: "#92400E",
    fontSize: 11,
    fontWeight: "800",
  },
  hintButtonTextUsed: {
    color: "#94A3B8",
  },
  hintCard: {
    marginTop: 18,
    borderRadius: 20,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 16,
  },
  hintCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  hintCardTitle: {
    color: "#92400E",
    fontSize: 15,
    fontWeight: "800",
  },
  hintBlock: {
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 12,
  },
  hintTitle: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 5,
  },
  hintTitleSecondary: {
    marginTop: 12,
  },
  hintText: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
  },
  answerInput: {
    minHeight: 132,
    maxHeight: 190,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    color: colors.text,
    backgroundColor: "#FFFFFF",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "500",
  },
  micButton: {
    height: 48,
    width: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  micButtonActive: {
    backgroundColor: colors.brand,
  },
});
