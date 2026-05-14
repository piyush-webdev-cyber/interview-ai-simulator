import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LockKeyhole, Mail, User2 } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { signInWithGoogle, supabase } from "@/lib/supabase";
import type { RootStackParamList } from "@/navigation/AppNavigator";
import { colors } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Signup">;

export function SignupScreen({ navigation }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async () => {
    setError(null);

    if (name.trim().length < 2) {
      Alert.alert("Name required", "Please enter your full name to create your account.");
      return;
    }
    if (!email.includes("@")) {
      Alert.alert("Email required", "Please enter a valid email address.");
      return;
    }
    if (password.trim().length < 8) {
      Alert.alert("Password too short", "Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Passwords do not match", "Please make sure both password fields match.");
      return;
    }

    setLoading(true);
    const { data, error: signupError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { name: name.trim() } },
    });
    setLoading(false);

    if (signupError) {
      setError(signupError.message);
      return;
    }

    if (!data.session) {
      Alert.alert("Check your email", "Confirm your email address, then log in.");
      navigation.navigate("Login");
      return;
    }

    navigation.replace("MainTabs");
  };

  const handleGoogleSignup = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      navigation.replace("MainTabs");
    } catch (googleError) {
      setError(googleError instanceof Error ? googleError.message : "Could not sign in with Google");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll={false}>
      <View style={styles.root}>
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />

        <View style={styles.card}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Create an account so you can explore all interview modes and track your progress.</Text>

          <View style={styles.form}>
            <InputRow icon={<User2 color={colors.brand} size={18} />} placeholder="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
            <InputRow
              icon={<Mail color={colors.brand} size={18} />}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <InputRow
              icon={<LockKeyhole color={colors.brand} size={18} />}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <InputRow
              icon={<LockKeyhole color={colors.brand} size={18} />}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Button label="Sign up" onPress={handleSignup} loading={loading} />
            <Button label="Continue with Google" onPress={handleGoogleSignup} loading={loading} variant="secondary" icon={<GoogleMark />} />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Already have an account?</Text>
            <Pressable onPress={() => navigation.navigate("Login")}>
              <Text style={styles.link}>Log in</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Screen>
  );
}

type InputRowProps = {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  autoCapitalize?: "none" | "words" | "sentences" | "characters";
  keyboardType?: "default" | "email-address";
  secureTextEntry?: boolean;
};

function InputRow({
  icon,
  placeholder,
  value,
  onChangeText,
  autoCapitalize = "none",
  keyboardType = "default",
  secureTextEntry = false,
}: InputRowProps) {
  return (
    <View style={styles.inputRow}>
      <View style={styles.iconShell}>{icon}</View>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#8B9AB3"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCorrect={false}
      />
    </View>
  );
}

function GoogleMark() {
  return (
    <View style={styles.googleMark}>
      <Text style={styles.googleMarkText}>G</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#EEF5FF",
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  glowTop: {
    position: "absolute",
    top: -60,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: 120,
    backgroundColor: "#D9E9FF",
    opacity: 0.7,
  },
  glowBottom: {
    position: "absolute",
    right: -50,
    bottom: -40,
    width: 220,
    height: 220,
    borderRadius: 120,
    backgroundColor: "#D9E9FF",
    opacity: 0.45,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 28,
    shadowColor: colors.brand,
    shadowOpacity: 0.12,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    color: colors.muted,
  },
  form: {
    marginTop: 26,
    gap: 14,
  },
  inputRow: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#D7E5FF",
    backgroundColor: "#F9FBFF",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconShell: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  actions: {
    marginTop: 14,
    gap: 12,
  },
  error: {
    marginTop: 14,
    marginBottom: 4,
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  switchRow: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  switchText: {
    color: colors.muted,
    fontSize: 14,
  },
  link: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "700",
  },
  googleMark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  googleMarkText: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: "800",
  },
});
