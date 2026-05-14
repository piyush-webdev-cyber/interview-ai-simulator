import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { Mail, ShieldCheck } from "lucide-react-native";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Screen } from "@/components/Screen";
import type { RootStackParamList } from "@/navigation/AppNavigator";
import { signInWithGoogle, supabase } from "@/lib/supabase";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.includes("@")) {
      Alert.alert("Email required", "Please enter your email address.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Password required", "Please enter your password.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);

    if (error) {
      Alert.alert("Login failed", error.message);
      return;
    }

    navigation.replace("MainTabs");
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      navigation.replace("MainTabs");
    } catch (error) {
      Alert.alert("Google sign-in failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View className="mb-10 mt-8">
        <Text className="text-xs font-bold uppercase tracking-[1px] text-muted">Welcome back</Text>
        <Text className="mt-3 text-4xl font-bold leading-[44px] text-ink">Log in to continue</Text>
        <Text className="mt-4 text-base leading-7 text-muted">
          Use your email and password, or continue with Google if that is how you created your account.
        </Text>
      </View>

      <View className="gap-4">
        <View>
          <Text className="mb-2 text-sm font-semibold text-slate-700">Email</Text>
          <View className="min-h-14 flex-row items-center gap-3 rounded-xl border border-slate-200 bg-white px-3">
            <Mail color="#64748B" size={18} />
            <TextInput
              className="flex-1 text-base text-ink"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>
        </View>

        <View>
          <Text className="mb-2 text-sm font-semibold text-slate-700">Password</Text>
          <View className="min-h-14 flex-row items-center gap-3 rounded-xl border border-slate-200 bg-white px-3">
            <ShieldCheck color="#64748B" size={18} />
            <TextInput
              className="flex-1 text-base text-ink"
              placeholder="Password"
              secureTextEntry
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
            />
          </View>
        </View>
      </View>

      <View className="mt-8 gap-3">
        <PrimaryButton label="Log in" loading={loading} onPress={handleLogin} />
        <PrimaryButton label="Continue with Google" loading={loading} variant="secondary" onPress={handleGoogleLogin} />
      </View>

      <View className="mt-6 flex-row items-center gap-2">
        <Text className="text-sm text-muted">Need an account first?</Text>
        <Pressable onPress={() => navigation.navigate("Signup")}>
          <Text className="text-sm font-semibold text-brand">Sign up</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
