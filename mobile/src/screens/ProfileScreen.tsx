import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Clock3, LogOut, Mail, ShieldCheck, UserCircle2 } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { supabase } from "@/lib/supabase";
import type { RootStackParamList } from "@/navigation/AppNavigator";
import { useInterviewStore } from "@/store/interviewStore";
import { colors } from "@/theme";

type ProfileUser = {
  email?: string;
  name?: string;
  provider?: string;
  created_at?: string;
};

function formatJoinedDate(raw?: string | null) {
  if (!raw) return "Not available";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { progress, loadProgress } = useInterviewStore();
  const [user, setUser] = useState<ProfileUser | null>(null);

  useFocusEffect(
    useCallback(() => {
      void loadProgress();
      supabase.auth.getUser().then(({ data, error }) => {
        if (error) return;
        const authUser = data.user;
        setUser({
          email: authUser?.email,
          name: typeof authUser?.user_metadata?.name === "string" ? authUser.user_metadata.name : authUser?.email?.split("@")[0],
          provider: authUser?.app_metadata?.provider,
          created_at: authUser?.created_at,
        });
      });
    }, [loadProgress])
  );

  const completionSummary = useMemo(() => {
    if (!progress) return "No completed interviews yet";
    return `${progress.total_interviews} interviews completed - avg ${Number(progress.average_score ?? 0).toFixed(1)}`;
  }, [progress]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigation.reset({
      index: 0,
      routes: [{ name: "Signup" as keyof RootStackParamList }],
    });
  };

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Your account details, security controls, and current interview progress all live here.</Text>

        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            <UserCircle2 color="#FFFFFF" size={56} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroName}>{user?.name ?? "Interview AI user"}</Text>
            <Text style={styles.heroMeta}>{user?.email ?? "No email available"}</Text>
            <View style={styles.providerBadge}>
              <ShieldCheck color="#BFDBFE" size={14} />
              <Text style={styles.providerText}>{user?.provider === "google" ? "Google account" : "Email account"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Joined</Text>
            <Text style={styles.statValue}>{formatJoinedDate(user?.created_at)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Status</Text>
            <Text style={styles.statValue}>Active</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Interview summary</Text>
          <Text style={styles.cardBody}>{completionSummary}</Text>
          {progress?.weak_topics?.length ? (
            <View style={styles.tagWrap}>
              {progress.weak_topics.slice(0, 4).map((topic) => (
                <Text key={topic} style={styles.tag}>
                  {topic}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={styles.muted}>Complete a few sessions and repeated weak spots will appear here.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account details</Text>
          <View style={styles.infoRow}>
            <Mail color={colors.brand} size={16} />
            <View style={styles.infoCopy}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email ?? "Not available"}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Clock3 color={colors.brand} size={16} />
            <View style={styles.infoCopy}>
              <Text style={styles.infoLabel}>Authentication</Text>
              <Text style={styles.infoValue}>{user?.provider === "google" ? "Google OAuth" : "Email and password"}</Text>
            </View>
          </View>
        </View>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <LogOut color={colors.danger} size={18} />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 20,
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  hero: {
    borderRadius: 20,
    backgroundColor: colors.dark,
    padding: 20,
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1D4ED8",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: {
    flex: 1,
  },
  heroName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  heroMeta: {
    marginTop: 4,
    color: "#CBD5E1",
    fontSize: 14,
  },
  providerBadge: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1E3A8A",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  providerText: {
    color: "#DBEAFE",
    fontSize: 12,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: 16,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  statValue: {
    marginTop: 8,
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  card: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },
  cardBody: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  tag: {
    backgroundColor: "#EFF6FF",
    color: colors.brand,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    alignItems: "flex-start",
  },
  infoCopy: {
    flex: 1,
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  infoValue: {
    marginTop: 4,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
  },
  logoutButton: {
    marginTop: 4,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: "800",
  },
});
