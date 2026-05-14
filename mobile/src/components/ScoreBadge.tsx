import { Text, View } from "react-native";

type ScoreBadgeProps = {
  label: string;
  score: number;
};

export function ScoreBadge({ label, score }: ScoreBadgeProps) {
  const color = score >= 8 ? "bg-emerald-100 text-emerald-700" : score >= 6 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return (
    <View className="mb-3 flex-row items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
      <Text className="text-sm font-medium text-slate-700">{label}</Text>
      <Text className={`rounded-md px-2 py-1 text-sm font-bold ${color}`}>{score.toFixed(1)}</Text>
    </View>
  );
}

