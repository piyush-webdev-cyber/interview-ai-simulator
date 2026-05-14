import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { LockOpen, RefreshCcw, Sparkles } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Dimensions, Easing, StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScoreBadge } from "@/components/ScoreBadge";
import { Screen } from "@/components/Screen";
import type { RootStackParamList } from "@/navigation/AppNavigator";
import { colors } from "@/theme";
import { useInterviewStore } from "@/store/interviewStore";

type Props = NativeStackScreenProps<RootStackParamList, "Feedback">;

function ConfettiOverlay({ visible }: { visible: boolean }) {
  const progress = useRef(new Animated.Value(0)).current;
  const { width, height } = Dimensions.get("window");
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => ({
        id: index,
        left: (index * 37) % Math.max(width - 24, 1),
        drift: index % 2 === 0 ? 28 + (index % 5) * 9 : -28 - (index % 5) * 9,
        delay: (index % 7) * 80,
        color: ["#2563EB", "#F59E0B", "#22C55E", "#EF4444", "#8B5CF6"][index % 5],
      })),
    [width],
  );

  useEffect(() => {
    if (!visible) {
      progress.setValue(0);
      return;
    }

    Animated.timing(progress, {
      toValue: 1,
      duration: 1800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, visible]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece) => {
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-40 - piece.delay / 8, height * 0.82],
        });
        const translateX = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, piece.drift],
        });
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", `${240 + piece.id * 18}deg`],
        });

        return (
          <Animated.View
            key={piece.id}
            style={[
              styles.confettiPiece,
              {
                left: piece.left,
                backgroundColor: piece.color,
                transform: [{ translateX }, { translateY }, { rotate }],
              },
            ]}
          />
        );
      })}
      <View style={styles.celebrationCard}>
        <Sparkles color="#FFFFFF" size={18} />
        <Text style={styles.celebrationTitle}>Let's move to the next round</Text>
      </View>
    </View>
  );
}

export function FeedbackScreen({ navigation }: Props) {
  const { session, finalReport, loadFeedback, loadProgress, loading, error } = useInterviewStore();
  const [showConfetti, setShowConfetti] = useState(false);
  const celebratedReportId = useRef<string | null>(null);
  const mockUnlocked = session?.mode === "Practice Mode" && Boolean(finalReport && finalReport.overall_score >= 7);

  useFocusEffect(
    useCallback(() => {
      void loadFeedback();
    }, [loadFeedback])
  );

  useEffect(() => {
    if (!mockUnlocked || !finalReport || celebratedReportId.current === finalReport.session_id) {
      return;
    }

    celebratedReportId.current = finalReport.session_id;
    setShowConfetti(true);
    void loadProgress();
    const timer = setTimeout(() => setShowConfetti(false), 2400);
    return () => clearTimeout(timer);
  }, [finalReport, loadProgress, mockUnlocked]);

  const handleUnlockMock = () => {
    setShowConfetti(true);
    void loadProgress();
    setTimeout(() => setShowConfetti(false), 2200);
    Alert.alert("Mock Interview unlocked", "Let's move to the next round.", [
      {
        text: "Start Mock Interview",
        onPress: () => navigation.navigate("RoleSelection", { mode: "Mock Interview", role: finalReport?.role }),
      },
    ]);
  };

  return (
    <Screen>
      <ConfettiOverlay visible={showConfetti} />
      <Text className="text-3xl font-bold text-ink">Feedback report</Text>
      <Text className="mt-2 text-base leading-6 text-muted">A structured readout across communication, domain knowledge, problem-solving, and confidence.</Text>

      {loading && !finalReport ? <Text className="mt-6 text-muted">Preparing your report...</Text> : null}
      {error ? <Text className="mt-4 text-sm text-red-600">{error}</Text> : null}

      {finalReport ? (
        <View className="mt-6">
          <View className="mb-5 rounded-lg bg-slate-900 p-5">
            <Text className="text-sm font-semibold uppercase tracking-wide text-blue-200">{finalReport.role}</Text>
            <Text className="mt-3 text-5xl font-bold text-white">{finalReport.overall_score.toFixed(1)}</Text>
            <Text className="mt-1 text-sm text-slate-300">Overall score out of 10</Text>
          </View>

          <Text className="mb-3 text-lg font-bold text-ink">Category breakdown</Text>
          {Object.entries(finalReport.category_breakdown).map(([label, score]) => (
            <ScoreBadge key={label} label={label} score={score} />
          ))}

          <Text className="mb-3 mt-5 text-lg font-bold text-ink">Strengths</Text>
          {finalReport.strengths.map((item) => (
            <Text key={item} className="mb-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm leading-5 text-emerald-800">
              {item}
            </Text>
          ))}

          <Text className="mb-3 mt-5 text-lg font-bold text-ink">Improvement roadmap</Text>
          {finalReport.improvement_roadmap.map((item, index) => (
            <Text key={item} className="mb-2 rounded-lg bg-panel px-4 py-3 text-sm leading-5 text-slate-700">
              {index + 1}. {item}
            </Text>
          ))}

          <View className="mt-6">
            <PrimaryButton
              label={mockUnlocked ? "Unlock Mock Interview" : "Practice another role"}
              variant={mockUnlocked ? "primary" : "secondary"}
              icon={mockUnlocked ? <LockOpen color="#FFFFFF" size={18} /> : <RefreshCcw color="#111827" size={18} />}
              onPress={mockUnlocked ? handleUnlockMock : () => navigation.navigate("RoleSelection")}
            />
            {mockUnlocked ? (
              <View className="mt-3 flex-row items-center justify-center gap-2">
                <Sparkles color={colors.brand} size={16} />
                <Text className="text-sm font-semibold text-brand">Score cleared. Mock Interview is ready.</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  confettiPiece: {
    position: "absolute",
    top: 0,
    width: 10,
    height: 16,
    borderRadius: 3,
  },
  celebrationCard: {
    position: "absolute",
    top: "38%",
    alignSelf: "center",
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: colors.brand,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#0F172A",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  celebrationTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
