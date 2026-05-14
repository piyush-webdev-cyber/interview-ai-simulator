import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BarChart3, Clock3, FileSearch, Home, MessageCircle, PencilLine, UserCircle2, UserRoundSearch, Zap } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/api/client";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import type { MainTabParamList, RootStackParamList } from "@/navigation/AppNavigator";
import { useInterviewStore } from "@/store/interviewStore";
import { colors } from "@/theme";
import type { InterviewMode } from "@/types/interview";

type RootNav = NativeStackNavigationProp<RootStackParamList>;

const MODE_ORDER: InterviewMode[] = ["Practice Mode", "Mock Interview", "Rapid Fire Mode"];
const MODES: Array<{ title: InterviewMode; description: string; icon: "mock" | "practice" | "rapid"; phase: string }> = [
  { title: "Practice Mode", description: "Five guided coaching questions built around weak areas and role fundamentals.", icon: "practice", phase: "Phase 1" },
  { title: "Mock Interview", description: "Strict interview simulation unlocked after you clear practice.", icon: "mock", phase: "Phase 2" },
  { title: "Rapid Fire Mode", description: "Quick final-phase prompts unlocked after you clear mock.", icon: "rapid", phase: "Phase 3" },
];

const DIFFICULTIES = ["Beginner", "Mid-level", "Senior"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

const LOCAL_ROLE_SUGGESTIONS = [
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Data Analyst",
  "DevOps Engineer",
  "Product Manager",
  "UI/UX Designer",
  "Sales Executive",
  "HR Manager",
  "Marketing Specialist",
  "Customer Support Representative",
  "Business Analyst",
  "Project Manager",
  "Quality Assurance Engineer",
  "Financial Analyst",
  "Content Strategist",
  "Operations Manager",
  "Graphic Designer",
  "Data Scientist",
  "Cybersecurity Analyst",
  "Technical Writer",
  "Mobile App Developer",
  "Cloud Solutions Architect",
  "AI/ML Engineer",
  "Network Administrator",
  "Database Administrator",
  "IT Support Specialist",
  "Digital Marketing Manager",
  "E-commerce Manager",
  "Social Media Manager",
  "Product Owner",
  "Scrum Master",
  "UX Researcher",
  "Business Development Manager",
  "Account Manager",
  "Financial Planner",
  "Legal Advisor",
  "Healthcare Administrator",
  "Education Coordinator",
  "Research Scientist",
  "Logistics Manager",
  "Event Planner",
  "Public Relations Specialist",
  "Content Creator",
  "Video Producer",
  "Audio Engineer",
  "Translator",
  "Recruiter",
  "Web Developer",
  "Software Engineer",
  "System Administrator",
];

function mergeSuggestions(local: string[], remote: string[]) {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const item of [...local, ...remote]) {
    const cleaned = item.trim();
    const key = cleaned.toLowerCase();
    if (cleaned.length < 2 || seen.has(key)) continue;
    seen.add(key);
    merged.push(cleaned);
  }
  return merged.slice(0, 8);
}

function filterLocalSuggestions(query: string) {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return [];
  return LOCAL_ROLE_SUGGESTIONS.filter((item) => item.toLowerCase().includes(normalized));
}

function difficultyProgressKey(difficulty: Difficulty) {
  return difficulty === "Mid-level" ? "Intermediate" : difficulty;
}

function isDifficultyUnlocked(unlocks: Record<string, boolean> | undefined, difficulty: Difficulty) {
  if (difficulty === "Beginner") return true;
  if (!unlocks) return false;
  if (difficulty === "Mid-level") return Boolean(unlocks["Mid-level"] ?? unlocks.Intermediate);
  return Boolean(unlocks[difficulty]);
}

function HighlightedSuggestion({ text, query }: { text: string; query: string }) {
  const normalized = query.trim();
  if (!normalized) return <Text style={styles.suggestionText}>{text}</Text>;
  const lowerText = text.toLowerCase();
  const lowerQuery = normalized.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) return <Text style={styles.suggestionText}>{text}</Text>;

  const before = text.slice(0, index);
  const match = text.slice(index, index + normalized.length);
  const after = text.slice(index + normalized.length);

  return (
    <Text style={styles.suggestionText}>
      {before}
      <Text style={styles.suggestionTextHighlight}>{match}</Text>
      {after}
    </Text>
  );
}

function InlineBottomTabs({
  activeTab,
  onTabPress,
  bottomInset = 8,
}: {
  activeTab: keyof MainTabParamList;
  onTabPress: (screen: keyof MainTabParamList) => void;
  bottomInset?: number;
}) {
  return (
    <View style={[inlineTabStyles.wrap, { paddingBottom: Math.max(bottomInset, 8) }]}>
      <View style={inlineTabStyles.row}>
        <Pressable accessibilityRole="button" style={inlineTabStyles.tab} onPress={() => onTabPress("Dashboard")}>
          <Home color={activeTab === "Dashboard" ? colors.brand : colors.muted} size={26} strokeWidth={2.1} />
          <Text style={[inlineTabStyles.label, activeTab === "Dashboard" && inlineTabStyles.labelActive]}>Dashboard</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={inlineTabStyles.tab} onPress={() => onTabPress("Roles")}>
          <UserRoundSearch color={activeTab === "Roles" ? colors.brand : colors.muted} size={26} strokeWidth={2.1} />
          <Text style={[inlineTabStyles.label, activeTab === "Roles" && inlineTabStyles.labelActive]}>Roles</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={inlineTabStyles.tab} onPress={() => onTabPress("Progress")}>
          <BarChart3 color={activeTab === "Progress" ? colors.brand : colors.muted} size={26} strokeWidth={2.1} />
          <Text style={[inlineTabStyles.label, activeTab === "Progress" && inlineTabStyles.labelActive]}>Progress</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={inlineTabStyles.tab} onPress={() => onTabPress("Resume")}>
          <FileSearch color={activeTab === "Resume" ? colors.brand : colors.muted} size={26} strokeWidth={2.1} />
          <Text style={[inlineTabStyles.label, activeTab === "Resume" && inlineTabStyles.labelActive]}>Resume</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={inlineTabStyles.tab} onPress={() => onTabPress("Profile")}>
          <UserCircle2 color={activeTab === "Profile" ? colors.brand : colors.muted} size={26} strokeWidth={2.1} />
          <Text style={[inlineTabStyles.label, activeTab === "Profile" && inlineTabStyles.labelActive]}>Profile</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function RoleSelectionScreen() {
  const navigation = useNavigation<RootNav>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { session, startInterview, restartInterview, loadProgress, progress, loading, error, clearError } = useInterviewStore();
  const [devUnlocks, setDevUnlocks] = useState<Partial<Record<InterviewMode, boolean>>>({});
  const initialMode = (route.params?.mode ?? "Practice Mode") as InterviewMode;
  const initialRole = route.params?.role ?? "";
  const [role, setRole] = useState(initialRole);
  const [difficulty, setDifficulty] = useState<Difficulty>("Beginner");
  const [mode, setMode] = useState<InterviewMode>(initialMode);
  const [showRoleError, setShowRoleError] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [dismissedQuery, setDismissedQuery] = useState("");
  const dockHeight = 138 + Math.max(insets.bottom, 8);
  const isInsideMainTabs = route.name === "Roles";

  const fallbackModeUnlocks: Record<InterviewMode, boolean> = {
    "Practice Mode": true,
    "Mock Interview": false,
    "Rapid Fire Mode": false,
  };
  const difficultyPhaseStatus =
    progress?.difficulty_phase_status?.[difficultyProgressKey(difficulty)] ??
    progress?.mode_unlocks ??
    fallbackModeUnlocks;
  const modeUnlocks = {
    "Practice Mode": true,
    "Mock Interview": Boolean(difficultyPhaseStatus["Mock Interview"]) || Boolean(devUnlocks["Mock Interview"]),
    "Rapid Fire Mode": Boolean(difficultyPhaseStatus["Rapid Fire Mode"]) || Boolean(devUnlocks["Rapid Fire Mode"]),
  };
  const difficultyUnlocks: Record<Difficulty, boolean> = {
    Beginner: true,
    "Mid-level": isDifficultyUnlocked(progress?.difficulty_unlocks, "Mid-level"),
    Senior: isDifficultyUnlocked(progress?.difficulty_unlocks, "Senior"),
  };

  useFocusEffect(
    useCallback(() => {
      void loadProgress();
    }, [loadProgress])
  );

  useEffect(() => {
    setRole(initialRole);
  }, [initialRole]);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!modeUnlocks[mode]) {
      setMode("Practice Mode");
    }
  }, [mode, modeUnlocks]);

  useEffect(() => {
    const query = role.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    const localSuggestions = filterLocalSuggestions(query);
    setSuggestions(localSuggestions);

    const timer = setTimeout(async () => {
      try {
        setSuggestionsLoading(true);
        const response = await api.suggestRoles(query);
        setSuggestions(mergeSuggestions(localSuggestions, response.suggestions));
      } catch {
        setSuggestions(localSuggestions);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [role]);

  const handleRoleChange = (value: string) => {
    setRole(value);
    setShowRoleError(false);
    clearError();
    if (value.trim() !== dismissedQuery) {
      setDismissedQuery("");
    }
  };

  const handleSuggestionSelect = (value: string) => {
    setRole(value);
    setSuggestions([]);
    setDismissedQuery(value.trim());
    setShowRoleError(false);
    clearError();
  };

  const handleDifficultySelect = (value: Difficulty) => {
    if (!difficultyUnlocks[value]) {
      const dependency =
        value === "Mid-level"
          ? "Clear Practice, Mock Interview, and Rapid Fire at Beginner with 7 or greater to unlock Mid-level."
          : "Clear Practice, Mock Interview, and Rapid Fire at Mid-level with 7 or greater to unlock Senior.";
      Alert.alert("Difficulty Locked", dependency);
      return;
    }
    setDifficulty(value);
    setMode("Practice Mode");
  };

  const handleModeSelect = (value: InterviewMode) => {
    if (!modeUnlocks[value]) {
      const lockMessage =
        value === "Mock Interview"
          ? "Score 7 or greater in Practice Mode to unlock Mock Interview."
          : "Score 7 or greater in Mock Interview to unlock Rapid Fire Mode.";
      Alert.alert("Phase Locked", lockMessage);
      return;
    }
    setMode(value);
  };

  const begin = async () => {
    const trimmedRole = role.trim();
    const normalized = trimmedRole.toLowerCase();

    if (normalized === "unlock-mock") {
      setDevUnlocks((current) => ({ ...current, "Mock Interview": true }));
      setMode("Mock Interview");
      setRole("");
      Alert.alert("Dev Bypass Activated", "Mock Interview is now unlocked for this app session.");
      return;
    }

    if (normalized === "unlock-rapid" || normalized === "unlock-all") {
      setDevUnlocks((current) => ({ ...current, "Mock Interview": true, "Rapid Fire Mode": true }));
      setMode("Rapid Fire Mode");
      setRole("");
      Alert.alert("Dev Bypass Activated", "Rapid Fire Mode is now unlocked for this app session.");
      return;
    }

    if (trimmedRole.length < 2) {
      setShowRoleError(true);
      Alert.alert("Role required", "Please enter a valid role before continuing.");
      return;
    }

    if (!modeUnlocks[mode]) {
      Alert.alert("Phase Locked", "Complete the previous phase with a strong score to unlock this interview mode.");
      return;
    }

    if (mode === "Practice Mode" && session?.mode === "Practice Mode" && session.state === "active" && session.history.length > 0) {
      Alert.alert(
        "Resume saved practice?",
        `You already answered ${session.history.length}/${session.total_questions ?? 5} questions for ${session.role}.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Resume",
            onPress: () => navigation.navigate("MainTabs", { screen: "PracticeInterview" }),
          },
          {
            text: "Restart",
            style: "destructive",
            onPress: async () => {
              const restarted = await restartInterview();
              if (restarted) {
                navigation.navigate("MainTabs", { screen: "PracticeInterview" });
              }
            },
          },
        ],
      );
      return;
    }

    const started = await startInterview(trimmedRole, difficulty, mode);
    if (started) {
      if (mode === "Practice Mode") {
        navigation.navigate("MainTabs", { screen: "PracticeInterview" });
        return;
      }
      navigation.navigate("MainTabs", { screen: "Interview" });
    }
  };

  const shouldShowSuggestions = useMemo(
    () => role.trim().length >= 2 && role.trim() !== dismissedQuery && (suggestions.length > 0 || suggestionsLoading),
    [dismissedQuery, role, suggestions.length, suggestionsLoading]
  );

  const navigateToTab = (screen: keyof MainTabParamList) => {
    navigation.navigate("MainTabs", { screen });
  };

  return (
    <Screen scroll={false}>
      <View style={styles.screen}>
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: (isInsideMainTabs ? 32 : dockHeight) + 28 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Interview Setup</Text>
            <Text style={styles.title}>Define your target role</Text>
            <Text style={styles.subtitle}>
              Enter the exact role you want to practice for, then choose the level you want the interview to target.
            </Text>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Enter your target role</Text>
            <Text style={styles.sectionCaption}>Required</Text>
          </View>

          <View style={styles.inputCard}>
            <View style={[styles.inputShell, (role.trim().length >= 2 || showRoleError) && styles.inputShellActive, showRoleError && styles.inputShellError]}>
              <PencilLine color={showRoleError ? colors.danger : role.trim().length >= 2 ? colors.brand : "#94A3B8"} size={16} />
              <TextInput
                value={role}
                onChangeText={handleRoleChange}
                placeholder="e.g., Frontend Developer, Data Analyst, Sales Executive"
                placeholderTextColor="#94A3B8"
                returnKeyType="done"
                autoCapitalize="words"
                autoCorrect={false}
                style={styles.input}
              />
            </View>
            <Text style={styles.helperText}>You can also add custom roles.</Text>

            {shouldShowSuggestions ? (
              <View style={styles.suggestionsCard}>
                {suggestionsLoading ? (
                  <View style={styles.suggestionLoadingRow}>
                    <ActivityIndicator size="small" color={colors.brand} />
                    <Text style={styles.suggestionLoadingText}>Finding role suggestions...</Text>
                  </View>
                ) : null}
                {suggestions.map((item) => (
                  <Pressable key={item} onPress={() => handleSuggestionSelect(item)} style={styles.suggestionRow}>
                    <HighlightedSuggestion text={item} query={role} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Difficulty</Text>
            <Text style={styles.sectionCaption}>Choose your interview depth</Text>
          </View>

          <View style={styles.pills}>
            {DIFFICULTIES.map((item) => (
              <Pressable
                key={item}
                accessibilityRole="button"
                onPress={() => handleDifficultySelect(item)}
                style={[styles.pill, difficulty === item && styles.pillActive, !difficultyUnlocks[item] && styles.pillLocked]}
              >
                <Text style={[styles.pillText, difficulty === item && styles.pillTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mode</Text>
            <Text style={styles.sectionCaption}>Practice first, then Mock Interview, then Rapid Fire</Text>
          </View>

          <View style={styles.modeStack}>
            {MODES.map((item) => {
              const active = mode === item.title;
              const locked = !modeUnlocks[item.title];
              return (
                <Pressable
                  key={item.title}
                  accessibilityRole="button"
                  onPress={() => handleModeSelect(item.title)}
                  style={[styles.modeCard, active && styles.modeCardActive, locked && styles.modeCardLocked]}
                >
                  <View style={styles.modeIconWrap}>
                    {item.icon === "mock" ? <MessageCircle color={active ? "#FFFFFF" : colors.brand} size={18} /> : null}
                    {item.icon === "practice" ? <Clock3 color={active ? "#FFFFFF" : colors.brand} size={18} /> : null}
                    {item.icon === "rapid" ? <Zap color={active ? "#FFFFFF" : colors.brand} size={18} /> : null}
                  </View>
                  <View style={styles.modeCopy}>
                    <Text style={[styles.modePhase, active && styles.modePhaseActive]}>{item.phase}</Text>
                    <Text style={[styles.modeTitle, active && styles.modeTitleActive]}>{item.title}</Text>
                    <Text style={[styles.modeDescription, active && styles.modeDescriptionActive]}>{item.description}</Text>
                  </View>
                  <View style={[styles.modeStatusBadge, active && styles.modeStatusBadgeActive, locked && styles.modeStatusBadgeLocked]}>
                    <Text style={[styles.modeStatusText, active && styles.modeStatusTextActive]}>
                      {locked ? "Locked" : active ? "Current" : "Open"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>Current setup</Text>
            <Text style={styles.summaryText}>{`${role.trim() || "No role entered"} | ${difficulty} | ${mode}`}</Text>
          </View>

          <View style={styles.devNote}>
            <Text style={styles.devNoteTitle}>Dev bypass</Text>
            <Text style={styles.devNoteText}>
              Practice Mode is the first phase. Type <Text style={styles.devCode}>unlock-mock</Text> to unlock Mock Interview, or{" "}
              <Text style={styles.devCode}>unlock-rapid</Text> to unlock Rapid Fire for this app session.
            </Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {isInsideMainTabs ? (
            <View style={styles.inlineActionWrap}>
              <Button
                label={mode === "Practice Mode" ? "Start Practice Mode" : mode === "Rapid Fire Mode" ? "Start Rapid Fire Mode" : "Start Mock Interview"}
                loading={loading}
                onPress={begin}
              />
            </View>
          ) : null}
        </ScrollView>

        {!isInsideMainTabs ? (
          <View style={styles.footerDock}>
            <View style={styles.footerActionWrap}>
              <Button
                label={mode === "Practice Mode" ? "Start Practice Mode" : mode === "Rapid Fire Mode" ? "Start Rapid Fire Mode" : "Start Mock Interview"}
                loading={loading}
                onPress={begin}
              />
            </View>
            <InlineBottomTabs activeTab="Roles" onTabPress={navigateToTab} bottomInset={insets.bottom} />
          </View>
        ) : null}
      </View>
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
    padding: 20,
  },
  header: {
    marginBottom: 24,
    paddingTop: 4,
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 23,
    color: "#5B6472",
    maxWidth: 340,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  sectionCaption: {
    color: "#8A94A6",
    fontSize: 13,
    fontWeight: "500",
  },
  inputCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E7EBF1",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: colors.text,
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  inputShell: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D8E0EA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inputShellActive: {
    borderColor: "#9FB4D8",
    backgroundColor: "#FCFDFF",
  },
  inputShellError: {
    borderColor: colors.danger,
    backgroundColor: "#FFF8F8",
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 12,
  },
  helperText: {
    marginTop: 8,
    color: "#7B8698",
    fontSize: 12,
    lineHeight: 17,
  },
  suggestionsCard: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  suggestionLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  suggestionLoadingText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
  },
  suggestionRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
  },
  suggestionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "500",
  },
  suggestionTextHighlight: {
    color: "#1D4ED8",
    fontWeight: "800",
  },
  pills: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  pill: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D7DEE7",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  pillActive: {
    borderColor: "#9FB4D8",
    backgroundColor: "#EDF4FD",
  },
  pillText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
  },
  pillTextActive: {
    color: "#1E40AF",
  },
  pillLocked: {
    opacity: 0.45,
  },
  modeStack: {
    gap: 12,
  },
  modeCard: {
    minHeight: 88,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DCE3EC",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: colors.text,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  modeCardActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  modeCardLocked: {
    opacity: 0.48,
  },
  modeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  modeCopy: {
    flex: 1,
  },
  modePhase: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  modePhaseActive: {
    color: "#93C5FD",
  },
  modeTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  modeTitleActive: {
    color: "#FFFFFF",
  },
  modeDescription: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  modeDescriptionActive: {
    color: "#CBD5E1",
  },
  modeStatusBadge: {
    borderRadius: 999,
    backgroundColor: "#EEF2F7",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modeStatusBadgeActive: {
    backgroundColor: "#1D4ED8",
  },
  modeStatusBadgeLocked: {
    backgroundColor: "#E5E7EB",
  },
  modeStatusText: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  modeStatusTextActive: {
    color: "#FFFFFF",
  },
  summary: {
    marginTop: 18,
    marginBottom: 14,
    borderRadius: 16,
    backgroundColor: "#F4F7FA",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  summaryLabel: {
    color: "#7B8698",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  summaryText: {
    marginTop: 6,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  devNote: {
    marginBottom: 14,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  devNoteTitle: {
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  devNoteText: {
    marginTop: 6,
    color: "#334155",
    fontSize: 13,
    lineHeight: 19,
  },
  devCode: {
    color: colors.text,
    fontWeight: "800",
  },
  error: {
    marginBottom: 12,
    color: colors.danger,
    lineHeight: 20,
  },
  inlineActionWrap: {
    marginTop: 8,
  },
  footerDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
  },
  footerActionWrap: {
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
});

const inlineTabStyles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: "#FFFFFF",
    paddingTop: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  tab: {
    minWidth: 62,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 2,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
  },
  labelActive: {
    color: colors.brand,
    fontWeight: "700",
  },
});
