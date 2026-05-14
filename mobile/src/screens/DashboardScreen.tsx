import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ArrowRight, Clock, MessageCircle, Zap } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import type { RootStackParamList } from "@/navigation/AppNavigator";
import { useInterviewStore } from "@/store/interviewStore";
import { colors } from "@/theme";
import type { InterviewMode } from "@/types/interview";

type RootNav = NativeStackNavigationProp<RootStackParamList>;

const MODE_ORDER: InterviewMode[] = ["Practice Mode", "Mock Interview", "Rapid Fire Mode"];
const MODES: Array<{ title: InterviewMode; description: string; icon: "mock" | "practice" | "rapid"; phase: string }> = [
  { title: "Practice Mode", description: "Five guided coaching questions that target weak areas first.", icon: "practice", phase: "Phase 1" },
  { title: "Mock Interview", description: "Strict interview simulation unlocked after you clear practice.", icon: "mock", phase: "Phase 2" },
  { title: "Rapid Fire Mode", description: "Fast final-phase questions unlocked after you clear mock.", icon: "rapid", phase: "Phase 3" },
];

export function DashboardScreen() {
  const navigation = useNavigation<RootNav>();
  const { progress, loadProgress } = useInterviewStore();
  const [selectedMode, setSelectedMode] = useState<InterviewMode>("Practice Mode");

  useFocusEffect(
    useCallback(() => {
      void loadProgress();
    }, [loadProgress])
  );

  const serverUnlocks = progress?.mode_unlocks ?? {
    "Practice Mode": true,
    "Mock Interview": false,
    "Rapid Fire Mode": false,
  };
  const modeUnlocks = {
    "Practice Mode": true,
    "Mock Interview": serverUnlocks["Mock Interview"] ?? false,
    "Rapid Fire Mode": serverUnlocks["Rapid Fire Mode"] ?? false,
  };
  const recommendedMode = progress?.recommended_next_mode ?? "Practice Mode";

  useEffect(() => {
    if (recommendedMode && modeUnlocks[recommendedMode]) {
      setSelectedMode(recommendedMode);
      return;
    }
    if (!modeUnlocks[selectedMode]) {
      setSelectedMode("Practice Mode");
    }
  }, [modeUnlocks, recommendedMode, selectedMode]);

  const startSelectedMode = () => {
    navigation.navigate("MainTabs", { screen: "Roles", params: { mode: selectedMode } });
  };

  const handleModePress = (mode: InterviewMode, locked: boolean) => {
    if (locked) {
      const lockMessage =
        mode === "Mock Interview"
          ? "Score 7 or greater in Practice Mode to unlock Mock Interview."
          : "Score 7 or greater in Mock Interview to unlock Rapid Fire Mode.";
      Alert.alert("Phase Locked", lockMessage);
      return;
    }
    setSelectedMode(mode);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Practice like it matters</Text>
        <Text style={styles.subtitle}>Start with coaching, then clear mock, then earn rapid fire.</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroKicker}>Interview ladder</Text>
        <Text style={styles.heroTitle}>Practice -&gt; Mock -&gt; Rapid Fire</Text>
        <Text style={styles.heroText}>
          Stay in sequence. Practice is open first. Score 7 or higher there to unlock Mock, then do it again in Mock to unlock Rapid Fire.
        </Text>
        <Button
          label={
            selectedMode === "Rapid Fire Mode"
              ? "Start Rapid Fire Mode"
              : selectedMode === "Mock Interview"
                ? "Start Mock Interview"
                : "Start Practice Mode"
          }
          icon={<ArrowRight color="#FFFFFF" size={18} />}
          onPress={startSelectedMode}
        />
      </View>

      <View style={styles.modeGrid}>
        {MODE_ORDER.map((title) => {
          const mode = MODES.find((item) => item.title === title)!;
          const active = selectedMode === mode.title;
          const locked = !modeUnlocks[mode.title];
          return (
            <Pressable
              key={mode.title}
              accessibilityRole="button"
              onPress={() => handleModePress(mode.title, locked)}
              style={[styles.modeCard, active && styles.modeCardActive, locked && styles.modeCardLocked]}
            >
              {mode.icon === "mock" ? <MessageCircle color={active ? "#FFFFFF" : colors.brand} size={22} /> : null}
              {mode.icon === "practice" ? <Clock color={active ? "#FFFFFF" : colors.brand} size={22} /> : null}
              {mode.icon === "rapid" ? <Zap color={active ? "#FFFFFF" : colors.brand} size={22} /> : null}
              <Text style={[styles.phaseLabel, active && styles.phaseLabelActive]}>{mode.phase}</Text>
              <Text style={[styles.cardTitle, active && styles.cardTitleActive]}>{mode.title}</Text>
              <Text style={[styles.cardText, active && styles.cardTextActive]}>{mode.description}</Text>
              <Text style={[styles.cardStatus, active && styles.cardStatusActive]}>
                {locked ? "Locked" : active ? "Current phase" : "Available"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.snapshot}>
        <Text style={styles.snapshotTitle}>Progress snapshot</Text>
        <Text style={styles.snapshotText}>
          {progress
            ? `${progress.total_interviews} completed interviews, ${Number(progress.average_score).toFixed(1)}/10 average.`
            : "Finish your first practice session to create a trend line."}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 22,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 24,
    color: colors.muted,
  },
  hero: {
    borderRadius: 10,
    backgroundColor: colors.dark,
    padding: 20,
    marginBottom: 18,
  },
  heroKicker: {
    color: "#BFDBFE",
    fontSize: 12,
    textTransform: "uppercase",
    fontWeight: "800",
    marginBottom: 8,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
  },
  heroText: {
    color: colors.darkMuted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  modeGrid: {
    gap: 12,
  },
  modeCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: 16,
  },
  modeCardActive: {
    borderColor: colors.dark,
    backgroundColor: colors.dark,
  },
  modeCardLocked: {
    opacity: 0.45,
  },
  cardTitle: {
    marginTop: 8,
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  cardTitleActive: {
    color: "#FFFFFF",
  },
  cardText: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  cardTextActive: {
    color: "#CBD5E1",
  },
  cardStatus: {
    marginTop: 10,
    color: colors.brand,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  cardStatusActive: {
    color: "#BFDBFE",
  },
  phaseLabel: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  phaseLabelActive: {
    color: "#93C5FD",
  },
  snapshot: {
    marginTop: 18,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: 16,
  },
  snapshotTitle: {
    fontWeight: "800",
    color: colors.text,
    fontSize: 16,
  },
  snapshotText: {
    marginTop: 6,
    color: colors.muted,
    lineHeight: 20,
  },
});
