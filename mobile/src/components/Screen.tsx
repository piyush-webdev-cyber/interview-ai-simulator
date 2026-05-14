import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors } from "@/theme";

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  edges?: Edge[];
}>;

export function Screen({ children, scroll = true, edges }: ScreenProps) {
  if (!scroll) {
    return <SafeAreaView edges={edges} style={styles.safe}>{children}</SafeAreaView>;
  }

  return (
    <SafeAreaView edges={edges} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Section({ children }: PropsWithChildren) {
  return <View style={styles.section}>{children}</View>;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 20,
  },
});
