import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BrainCircuit } from "lucide-react-native";
import { useEffect } from "react";
import { Text, View } from "react-native";
import type { RootStackParamList } from "@/navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Splash">;

export function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    const timeout = setTimeout(() => navigation.replace("Signup"), 700);
    return () => clearTimeout(timeout);
  }, [navigation]);

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <View className="mb-5 h-20 w-20 items-center justify-center rounded-2xl bg-blue-50">
        <BrainCircuit color="#2563EB" size={42} />
      </View>
      <Text className="text-center text-3xl font-bold text-ink">Interview AI Simulator</Text>
      <Text className="mt-3 text-center text-base text-muted">Realistic mobile mock interviews with deep feedback.</Text>
    </View>
  );
}
