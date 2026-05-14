import { useFocusEffect } from "@react-navigation/native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RotateCcw, TrendingUp } from "lucide-react-native";
import { useCallback } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { ScoreBadge } from "@/components/ScoreBadge";
import { Screen } from "@/components/Screen";
import type { RootStackParamList } from "@/navigation/AppNavigator";
import { useInterviewStore } from "@/store/interviewStore";
import { colors } from "@/theme";

type RootNav = NativeStackNavigationProp<RootStackParamList>;

export function ProgressScreen() {
  const navigation = useNavigation<RootNav>();
  const { session, progress, loadProgress, restartInterview, clearActiveSession, loading, error } = useInterviewStore();
  const hasActivePractice = session?.mode === "Practice Mode" && session.state === "active" && (session.history.length > 0 || Boolean(session.current_question));
  const answeredCount = session?.history.length ?? 0;
  const totalQuestions = session?.total_questions ?? 5;
  const lastScore = session?.history[session.history.length - 1]?.feedback?.score;
  const savedAnswers = session?.history ?? [];

  useFocusEffect(
    useCallback(() => {
      void loadProgress();
    }, [loadProgress])
  );

  const resumePractice = () => {
    navigation.navigate("MainTabs", { screen: "PracticeInterview" });
  };

  const restartPractice = () => {
    Alert.alert("Restart Practice Mode?", "This will start again from question 1 and replace the saved active practice session.", [
      { text: "Cancel", style: "cancel" },
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
    ]);
  };

  return (
    <Screen>
      <Text className="text-3xl font-bold text-ink">Progress</Text>
      <Text className="mt-2 text-base leading-6 text-muted">Track score trends, repeated weak topics, and recent mock interviews.</Text>

      {loading && !progress ? <Text className="mt-6 text-muted">Loading progress...</Text> : null}
      {error ? <Text className="mt-4 text-sm text-red-600">{error}</Text> : null}

      <View className="mt-6 rounded-lg bg-slate-900 p-5">
        <View className="flex-row items-center gap-3">
          <TrendingUp color="#BFDBFE" size={22} />
          <Text className="text-base font-semibold text-blue-100">Performance summary</Text>
        </View>
        <Text className="mt-4 text-5xl font-bold text-white">{progress?.average_score.toFixed(1) ?? "0.0"}</Text>
        <Text className="mt-1 text-sm text-slate-300">{progress?.total_interviews ?? 0} completed interviews</Text>
      </View>

      {hasActivePractice ? (
        <View className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text className="text-xs font-bold uppercase tracking-wide text-blue-700">Saved Practice Session</Text>
              <Text className="mt-2 text-lg font-bold text-ink">{session.role}</Text>
              <Text className="mt-1 text-sm leading-5 text-slate-600">
                {`Answered ${answeredCount}/${totalQuestions}. Resume at question ${Math.min(answeredCount + 1, totalQuestions)}.`}
              </Text>
              {typeof lastScore === "number" ? <Text className="mt-1 text-sm font-semibold text-blue-700">{`Last score: ${lastScore.toFixed(1)}/10`}</Text> : null}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                clearActiveSession();
                Alert.alert("Saved session cleared", "You can start again from question 1 from the Roles tab.");
              }}
              className="h-9 w-9 items-center justify-center rounded-full bg-white"
            >
              <RotateCcw color={colors.muted} size={18} />
            </Pressable>
          </View>
          <View className="mt-4 gap-3">
            <Button label="Resume" onPress={resumePractice} />
            <Button label="Restart from Question 1" variant="secondary" onPress={restartPractice} />
          </View>

          {savedAnswers.length ? (
            <View className="mt-5 border-t border-blue-100 pt-4">
              <Text className="text-xs font-bold uppercase tracking-wide text-blue-700">Answered Questions</Text>
              <View className="mt-3 gap-3">
                {savedAnswers.map((item, index) => {
                  const score = item.feedback?.score;
                  return (
                    <View key={`${item.round}-${index}`} className="rounded-lg bg-white p-3">
                      <View className="flex-row items-center justify-between gap-3">
                        <Text className="text-sm font-bold text-ink">{`Q${index + 1}`}</Text>
                        {typeof score === "number" ? <Text className="text-sm font-bold text-blue-700">{`${score.toFixed(1)}/10`}</Text> : null}
                      </View>
                      <Text className="mt-2 text-sm leading-5 text-slate-700" numberOfLines={2}>
                        {item.question}
                      </Text>
                      {item.feedback?.final_feedback ? (
                        <Text className="mt-2 text-xs leading-4 text-muted" numberOfLines={2}>
                          {item.feedback.final_feedback}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      <Text className="mb-3 mt-6 text-lg font-bold text-ink">Score trend</Text>
      {progress?.score_trends.length ? (
        progress.score_trends.map((item) => <ScoreBadge key={item.session_id} label={item.role} score={Number(item.score)} />)
      ) : (
        <Text className="rounded-lg bg-panel p-4 text-sm leading-5 text-muted">No completed interviews yet. Finish a mock interview to create your first trend point.</Text>
      )}

      <Text className="mb-3 mt-6 text-lg font-bold text-ink">Weak topics</Text>
      {progress?.weak_topics.length ? (
        <View className="flex-row flex-wrap gap-2">
          {progress.weak_topics.map((topic) => (
            <Text key={topic} className="rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
              {topic}
            </Text>
          ))}
        </View>
      ) : (
        <Text className="rounded-lg bg-panel p-4 text-sm leading-5 text-muted">Weak topics will appear after your feedback reports are generated.</Text>
      )}
    </Screen>
  );
}
