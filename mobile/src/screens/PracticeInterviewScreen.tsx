import { CircleAlert, Lightbulb, ListChecks, SendHorizonal, Sparkles, Target } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { useInterviewStore } from "@/store/interviewStore";
import { colors } from "@/theme";

type Props = {
  navigation: any;
};
const MAX_HINTS_PER_SESSION = 2;

function FeedbackPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.feedbackPill}>
      <Text style={styles.feedbackPillLabel}>{label}</Text>
      <Text style={styles.feedbackPillValue}>{value}</Text>
    </View>
  );
}

function cleanQuestion(question: string) {
  return question.replace(/\s+/g, " ").replace(/^["']|["']$/g, "").trim();
}

function buildPracticeHint(question: string, role: string) {
  const cleaned = cleanQuestion(question);
  const lower = cleaned.toLowerCase();
  const roleLabel = role || "this role";

  if (lower.includes("button") && lower.includes("react")) {
    return {
      answer:
        "I would answer it like this: I would build a reusable Button component with a small, explicit API: variant, size, disabled, loading, type, onPress or onClick, leftIcon, rightIcon, ariaLabel, className, and children. The component would always apply a base class such as inline-flex items-center justify-center gap-2 rounded-md font-medium transition focus-visible:outline-none focus-visible:ring-2. Then I would map variants like primary, secondary, danger, and ghost to separate class strings, and sizes like sm, md, and lg to padding and text-size classes. For example, primary could be bg-blue-600 text-white hover:bg-blue-700, while secondary could be border border-slate-300 bg-white text-slate-900 hover:bg-slate-50. Disabled and loading states should set disabled, aria-disabled, opacity-50, cursor-not-allowed, and prevent duplicate submissions. If the button only shows an icon, ariaLabel should be required so screen readers still understand the action. I would test the component by rendering primary, secondary, disabled, loading, icon-only, and keyboard focus states.",
      explanation:
        "This answer should score highly because it directly answers the props and CSS-class part of the question, gives concrete class examples, covers disabled/loading/accessibility states, and explains how the design stays reusable and testable.",
    };
  }

  if (lower.includes("table") || lower.includes("pagination")) {
    return {
      answer:
        "I would answer it like this: I would make the reusable table controlled and data-driven. The main props would be columns, rows, rowKey, page, pageSize, totalRows, onPageChange, sort, onSortChange, loading, emptyMessage, selectedRowIds, onRowSelect, ariaLabel, and renderRowActions. Each column would define header, accessor or renderCell, width, align, sortable, and hideOnMobile. For pagination, the parent should own page and pageSize so the same component works for client-side and server-side data. For example, when the user clicks Next, the table calls onPageChange(page + 1), the parent fetches the new page, and the table shows a loading state. For accessibility I would use real table semantics, scope='col' on headers, aria-sort on sortable columns, keyboard-reachable row actions, and a clear empty state.",
      explanation:
        "This answer should score highly because it names a full component contract, explains controlled pagination, includes a concrete interaction example, and covers accessibility instead of only describing visual table rendering.",
    };
  }

  if (lower.includes("api") || lower.includes("endpoint") || lower.includes("backend")) {
    return {
      answer:
        "I would answer it like this: I would start by defining the endpoint contract: method, URL, request body, response shape, auth requirement, validation rules, and failure cases. For example, for POST /tasks I would require a title, optional dueDate, and authenticated user ID, then return the created task with id, status, and timestamps. In implementation I would validate input at the route boundary, check permissions, call a service function for business logic, and keep database access in a repository layer. I would return consistent 400, 401, 403, and 500 errors, log unexpected failures, and test success, invalid input, unauthorized access, forbidden access, and database failure cases.",
      explanation:
        `For a ${roleLabel}, this answer should score highly because it covers contract design, validation, auth, layered architecture, error handling, logging, and tests with a concrete endpoint example.`,
    };
  }

  if (lower.includes("database") || lower.includes("schema") || lower.includes("sql")) {
    return {
      answer:
        "I would answer it like this: I would first identify the entities, relationships, and access patterns before choosing tables. For example, in a task-management feature I would use users, projects, tasks, and task_comments. Tasks would have id, project_id, assignee_id, title, status, priority, due_date, created_at, and updated_at. I would add foreign keys to protect relationships, indexes on project_id, assignee_id, status, and due_date for common filters, and constraints so status only accepts valid values. I would avoid duplicating data unless reporting performance requires it. I would also explain how the schema supports creating tasks, listing tasks by project, filtering by status, and future additions like labels.",
      explanation:
        "This answer should score highly because it gives a concrete schema, explains relationships, indexes, constraints, access patterns, and future extensibility. It shows database judgment, not just table naming.",
    };
  }

  if (lower.includes("test") || lower.includes("debug")) {
    return {
      answer:
        "I would answer it like this: I would first reproduce the issue with the smallest reliable case, then inspect logs, network calls, and recent changes to isolate the failing layer. For example, if a form submits twice, I would check whether the button remains enabled during loading, whether the API receives duplicate requests, and whether retry logic is firing. Once I identify the cause, I would write a failing test for that exact behavior, fix the implementation, and verify the test passes. I would also run the related test suite and search for the same pattern elsewhere so the bug does not reappear in another screen.",
      explanation:
        "This answer should score highly because it gives a clear debugging workflow, a concrete example, test coverage, verification, and prevention. It demonstrates practical engineering discipline.",
    };
  }

  if (lower.includes("accessibility") || lower.includes("a11y")) {
    return {
      answer:
        "I would answer it like this: I would treat accessibility as part of the component requirements, not a final cleanup task. I would use semantic elements where possible, provide labels for controls, keep visible focus states, support keyboard navigation, and ensure color contrast meets WCAG guidance. For example, an icon-only delete button needs an aria-label like 'Delete task', a visible focus ring, and a disabled state that is announced correctly. If the UI has errors or loading states, I would announce them with accessible text or live regions where appropriate. I would test by tabbing through the flow, using a screen reader, and checking that every action is understandable without relying only on color or icons.",
      explanation:
        "This answer should score highly because it gives specific accessibility requirements, a concrete icon-button example, and verification steps. It shows the candidate knows how to implement and test accessibility.",
    };
  }

  return {
    answer: `I would answer it like this: The goal is to solve the specific problem in the question: "${cleaned}". I would first clarify the expected outcome and constraints, then describe the exact approach I would take. For example, I would break the work into requirements, implementation steps, edge cases, and validation. I would name the important tradeoffs, such as speed versus maintainability, flexibility versus complexity, or user experience versus technical cost. Then I would explain how I would verify the result with tests, real user scenarios, logs, or metrics. I would finish by stating the expected outcome and what I would improve next if more time were available.`,
    explanation:
      `This answer should score highly for a ${roleLabel} because it is complete: it restates the goal, gives an implementation approach, includes a concrete example structure, discusses tradeoffs, and explains validation. It avoids vague claims and shows interview-ready reasoning.`,
  };
}

export function PracticeInterviewScreen({ navigation }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [answer, setAnswer] = useState("");
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintedQuestionKeys, setHintedQuestionKeys] = useState<string[]>([]);
  const { session, latestFeedback, submitAnswer, loading, error } = useInterviewStore();

  const dockHeight = 64;
  const totalQuestions = Math.max(session?.total_questions ?? 1, 1);
  const questionNumber = useMemo(() => {
    if (!session) return 1;
    return Math.min(session.history.length + 1, totalQuestions);
  }, [session, totalQuestions]);
  const currentQuestionKey = `${questionNumber}:${session?.current_question ?? ""}`;
  const isCurrentQuestionHintRevealed = hintedQuestionKeys.includes(currentQuestionKey);
  const practiceHints = useMemo(
    () => {
      const hint = buildPracticeHint(session?.current_question ?? "", session?.role ?? "");
      return [
        { title: "Model answer", body: hint.answer, explanation: hint.explanation },
      ];
    },
    [session?.current_question, session?.role],
  );
  const remainingHints = Math.max(MAX_HINTS_PER_SESSION - hintsUsed, 0);

  useEffect(() => {
    setHintsUsed(0);
    setHintedQuestionKeys([]);
  }, [session?.id]);

  useEffect(() => {
    setAnswer("");
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [session?.current_question]);

  if (!session) {
    return (
      <Screen>
        <Text style={styles.emptyTitle}>No active practice session</Text>
        <Text style={styles.emptySubtitle}>Start Practice Mode from the role setup screen first.</Text>
        <Button label="Choose a role" onPress={() => navigation.navigate("RoleSelection", { mode: "Practice Mode" })} />
      </Screen>
    );
  }

  const submit = async () => {
    const trimmed = answer.trim();
    if (!trimmed) return;
    const completed = await submitAnswer(trimmed);
    if (completed) {
      navigation.replace("Feedback");
      return;
    }
    setAnswer("");
  };

  const handleHintPress = () => {
    if (remainingHints <= 0) {
      Alert.alert("No hints left", "You have used all 2 hints for this practice session.");
      return;
    }

    if (isCurrentQuestionHintRevealed) {
      Alert.alert("Hint already shown", "You already used a hint for this question. Save the remaining hint for another question.");
      return;
    }

    Alert.alert(
      "Use a hint?",
      `You have ${remainingHints} of ${MAX_HINTS_PER_SESSION} total hints left for this 5-question practice session. Using this will spend 1 hint.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Use hint",
          onPress: () => {
            const nextHintsUsed = Math.min(hintsUsed + 1, MAX_HINTS_PER_SESSION);
            setHintsUsed(nextHintsUsed);
            setHintedQuestionKeys((keys) => (keys.includes(currentQuestionKey) ? keys : [...keys, currentQuestionKey]));
            if (nextHintsUsed === MAX_HINTS_PER_SESSION) {
              Alert.alert("All hints used", "You have used all 2 hints for this practice session.");
            }
          },
        },
      ],
    );
  };

  const missingPoints = latestFeedback?.missing_points?.length ? latestFeedback.missing_points : latestFeedback?.weaknesses ?? [];
  const improvementTips = latestFeedback?.improvement_tips?.length
    ? latestFeedback.improvement_tips
    : latestFeedback?.improvements ?? [];

  return (
    <Screen scroll={false} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.screen}>
        <ScrollView
          ref={scrollRef}
          style={styles.contentScroll}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: dockHeight + 20 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.roleLabel}>{session.role.toUpperCase()}</Text>
              <Text style={styles.title}>Practice Mode</Text>
              <Text style={styles.subtitle}>Focused coaching on weak areas, better answers, and stronger follow-ups.</Text>
            </View>
            <View style={styles.headerTools}>
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{`Q${questionNumber}/${totalQuestions}`}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={handleHintPress}
                style={[styles.headerHintButton, remainingHints <= 0 && styles.headerHintButtonUsed]}
              >
                <View style={styles.headerHintIconWrap}>
                  <Lightbulb color={remainingHints <= 0 ? "#94A3B8" : "#D97706"} size={20} />
                  <View style={styles.headerHintBadge}>
                    <Text style={styles.headerHintBadgeText}>{remainingHints}</Text>
                  </View>
                </View>
                <Text style={[styles.headerHintText, remainingHints <= 0 && styles.headerHintTextUsed]}>
                  {remainingHints <= 0 ? "Used" : "Hint"}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.focusCard}>
            <Target color={colors.brand} size={18} />
            <View style={styles.focusCopy}>
              <Text style={styles.focusLabel}>Current focus</Text>
              <Text style={styles.focusValue}>{latestFeedback?.next_focus_area ?? "Role fundamentals and practical clarity"}</Text>
            </View>
          </View>

          <View style={styles.questionCard}>
            <Text style={styles.questionEyebrow}>Practice question</Text>
            <Text style={styles.questionText}>{session.current_question}</Text>
          </View>

          {isCurrentQuestionHintRevealed ? (
            <View style={styles.hintCard}>
              <View style={styles.hintCardHeader}>
                <Lightbulb color="#D97706" size={18} />
                <Text style={styles.hintCardTitle}>{`Hints left ${remainingHints}/${MAX_HINTS_PER_SESSION}`}</Text>
              </View>
              {practiceHints.map((hint) => (
                <View key={hint.title} style={styles.hintExplainBlock}>
                  <Text style={styles.hintExplainTitle}>{hint.title}</Text>
                  <Text selectable style={styles.hintExplainText}>{hint.body}</Text>
                  <Text style={[styles.hintExplainTitle, styles.hintExplainTitleSecondary]}>Why this works</Text>
                  <Text selectable style={styles.hintExplainText}>{hint.explanation}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.answerCard}>
            <Text style={styles.answerLabel}>Your answer</Text>
            <TextInput
              value={answer}
              onChangeText={setAnswer}
              onFocus={() => {
                setTimeout(() => {
                  scrollRef.current?.scrollToEnd({ animated: true });
                }, 120);
              }}
              placeholder="Answer with a concrete example, reasoning, and outcome..."
              placeholderTextColor="#94A3B8"
              multiline
              scrollEnabled
              textAlignVertical="top"
              style={styles.answerInput}
            />
            <Text style={styles.answerHint}>We'll score it honestly, then show how to make it stronger.</Text>
          </View>

          {latestFeedback ? (
            <View style={styles.feedbackCard}>
              <View style={styles.feedbackHeader}>
                <Text style={styles.feedbackTitle}>Coaching feedback</Text>
                <View style={styles.feedbackPillRow}>
                  <FeedbackPill label="Score" value={latestFeedback.score.toFixed(1)} />
                  <FeedbackPill label="Level" value={(latestFeedback.level ?? "medium").toUpperCase()} />
                </View>
              </View>

              <Text style={styles.feedbackSummary}>
                {latestFeedback.final_feedback ?? "This answer has been scored. Use the notes below to sharpen the next one."}
              </Text>

              {latestFeedback.hint ? (
                <View style={styles.infoBlock}>
                  <View style={styles.infoHeader}>
                    <Lightbulb color="#D97706" size={16} />
                    <Text style={styles.infoTitle}>Hint</Text>
                  </View>
                  <Text style={styles.infoText}>{latestFeedback.hint}</Text>
                </View>
              ) : null}

              {missingPoints.length ? (
                <View style={styles.infoBlock}>
                  <View style={styles.infoHeader}>
                    <CircleAlert color="#DC2626" size={16} />
                    <Text style={styles.infoTitle}>What was missing</Text>
                  </View>
                  {missingPoints.map((item) => (
                    <Text key={item} style={styles.bulletText}>{`- ${item}`}</Text>
                  ))}
                </View>
              ) : null}

              {latestFeedback.ideal_answer ? (
                <View style={styles.infoBlock}>
                  <View style={styles.infoHeader}>
                    <Sparkles color={colors.brand} size={16} />
                    <Text style={styles.infoTitle}>Better version</Text>
                  </View>
                  <Text style={styles.infoText}>{latestFeedback.ideal_answer}</Text>
                </View>
              ) : null}

              {improvementTips.length ? (
                <View style={styles.infoBlock}>
                  <View style={styles.infoHeader}>
                    <ListChecks color="#0F766E" size={16} />
                    <Text style={styles.infoTitle}>How to answer next time</Text>
                  </View>
                  {improvementTips.map((item) => (
                    <Text key={item} style={styles.bulletText}>{`- ${item}`}</Text>
                  ))}
                </View>
              ) : null}

              {latestFeedback.follow_up_question ? (
                <View style={styles.followUpCard}>
                  <Text style={styles.followUpLabel}>Next follow-up</Text>
                  <Text style={styles.followUpText}>{latestFeedback.follow_up_question}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.submitDock}>
          <View style={styles.footerActionWrap}>
            <Button
              label="Submit Practice Answer"
              loading={loading}
              disabled={!answer.trim()}
              icon={<SendHorizonal color="#FFFFFF" size={18} />}
              onPress={submit}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  headerCopy: {
    flex: 1,
  },
  roleLabel: {
    color: "#8A94A6",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  title: {
    marginTop: 6,
    color: "#0F172A",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 8,
    color: "#64748B",
    fontSize: 14,
    lineHeight: 21,
  },
  headerTools: {
    alignItems: "center",
    gap: 11,
  },
  headerBadge: {
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerBadgeText: {
    color: "#1D4ED8",
    fontSize: 14,
    fontWeight: "800",
  },
  headerHintButton: {
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
  headerHintButtonUsed: {
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  headerHintIconWrap: {
    position: "relative",
  },
  headerHintBadge: {
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
  headerHintBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "900",
  },
  headerHintText: {
    color: "#92400E",
    fontSize: 11,
    fontWeight: "800",
  },
  headerHintTextUsed: {
    color: "#94A3B8",
  },
  focusCard: {
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  focusCopy: {
    flex: 1,
  },
  focusLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  focusValue: {
    marginTop: 6,
    color: "#0F172A",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
  },
  questionCard: {
    borderRadius: 24,
    backgroundColor: "#1E293B",
    padding: 22,
    shadowColor: "#0F172A",
    shadowOpacity: 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
    marginBottom: 14,
  },
  questionEyebrow: {
    color: "#BFDBFE",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  questionText: {
    color: "#F8FAFC",
    fontSize: 20,
    lineHeight: 29,
    fontWeight: "700",
  },
  hintCard: {
    borderRadius: 20,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 16,
    marginBottom: 14,
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
  hintAnswer: {
    color: "#1F2937",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  hintExplainBlock: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 12,
  },
  hintExplainTitle: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 5,
  },
  hintExplainTitleSecondary: {
    marginTop: 12,
  },
  hintExplainText: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
  },
  answerCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 16,
    marginBottom: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  answerLabel: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 10,
  },
  answerInput: {
    minHeight: 130,
    maxHeight: 180,
    color: "#0F172A",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  answerHint: {
    marginTop: 8,
    color: "#64748B",
    fontSize: 12,
    lineHeight: 18,
  },
  feedbackCard: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    marginBottom: 12,
  },
  feedbackHeader: {
    gap: 12,
    marginBottom: 10,
  },
  feedbackTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
  },
  feedbackPillRow: {
    flexDirection: "row",
    gap: 10,
  },
  feedbackPill: {
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  feedbackPillLabel: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  feedbackPillValue: {
    marginTop: 2,
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "800",
  },
  feedbackSummary: {
    color: "#0F172A",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    marginBottom: 12,
  },
  infoBlock: {
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    padding: 14,
    marginBottom: 12,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  infoTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
  },
  infoText: {
    color: "#334155",
    fontSize: 14,
    lineHeight: 21,
  },
  bulletText: {
    color: "#334155",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
  },
  followUpCard: {
    borderRadius: 18,
    backgroundColor: "#EEF6FF",
    padding: 14,
  },
  followUpLabel: {
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  followUpText: {
    marginTop: 8,
    color: "#0F172A",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
  },
  error: {
    marginTop: 8,
    color: colors.danger,
    lineHeight: 20,
  },
  submitDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 4,
    backgroundColor: "#FFFFFF",
    zIndex: 20,
    elevation: 20,
  },
  footerActionWrap: {
    paddingTop: 6,
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800",
  },
  emptySubtitle: {
    marginTop: 8,
    marginBottom: 12,
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
});
