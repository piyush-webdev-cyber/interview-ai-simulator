import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { FileSearch, FileText, Sparkles, Target, Upload } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { useInterviewStore } from "@/store/interviewStore";
import { colors } from "@/theme";

type PickedResumeFile = {
  name: string;
  mimeType: string | null;
  size: number | null;
  base64: string;
};

function formatFileSize(size: number | null) {
  if (!size || size <= 0) return "Unknown size";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function ResumeAnalyzerScreen() {
  const { analyzeResumeFile, resumeAnalysis, loading, error, clearError } = useInterviewStore();
  const [targetRole, setTargetRole] = useState("");
  const [pickedFile, setPickedFile] = useState<PickedResumeFile | null>(null);

  const pickResume = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
          "text/markdown",
        ],
      });

      if (result.canceled || !result.assets.length) return;

      const asset = result.assets[0];
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setPickedFile({
        name: asset.name,
        mimeType: asset.mimeType ?? null,
        size: asset.size ?? null,
        base64,
      });
      clearError();
    } catch {
      Alert.alert("Upload failed", "We couldn't open that file. Try picking it again.");
    }
  };

  const runAnalysis = async () => {
    const trimmedRole = targetRole.trim();

    if (trimmedRole.length < 2) {
      Alert.alert("Role required", "Enter the target role before analyzing the resume.");
      return;
    }

    if (!pickedFile) {
      Alert.alert("Resume file required", "Upload your resume file before running the ATS analysis.");
      return;
    }

    clearError();
    await analyzeResumeFile({
      target_role: trimmedRole,
      file_name: pickedFile.name,
      file_base64: pickedFile.base64,
      file_mime_type: pickedFile.mimeType,
    });
  };

  return (
    <Screen scroll={false}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Resume analyzer</Text>
          <Text style={styles.title}>Upload your resume and check ATS readiness</Text>
          <Text style={styles.subtitle}>
            Pick your resume file, set the target role, and get missing keywords, weak sections, and stronger rewrite examples.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Target role</Text>
            <Text style={styles.labelHint}>Required</Text>
          </View>
          <View style={styles.inputShell}>
            <Target color={colors.brand} size={16} />
            <TextInput
              value={targetRole}
              onChangeText={setTargetRole}
              placeholder="e.g., Frontend Developer, Data Analyst"
              placeholderTextColor="#94A3B8"
              autoCapitalize="words"
              autoCorrect={false}
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Resume file</Text>
            <Text style={styles.labelHint}>PDF, DOCX, TXT, MD</Text>
          </View>
          <Button label={pickedFile ? "Replace Resume File" : "Upload Resume File"} icon={<Upload color="#FFFFFF" size={18} />} onPress={pickResume} />

          {pickedFile ? (
            <View style={styles.fileCard}>
              <View style={styles.fileIconWrap}>
                <FileText color={colors.brand} size={18} />
              </View>
              <View style={styles.fileCopy}>
                <Text style={styles.fileName}>{pickedFile.name}</Text>
                <Text style={styles.fileMeta}>
                  {pickedFile.mimeType ?? "Unknown type"} - {formatFileSize(pickedFile.size)}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.helper}>Choose a PDF, DOCX, TXT, or Markdown resume. The app will send it to the backend for extraction and scoring.</Text>
          )}
        </View>

        <Button
          label="Analyze Resume"
          loading={loading}
          disabled={loading}
          icon={loading ? <ActivityIndicator color="#FFFFFF" /> : <FileSearch color="#FFFFFF" size={18} />}
          onPress={runAnalysis}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {resumeAnalysis ? (
          <>
            <View style={styles.scoreCard}>
              <View style={styles.scoreHeader}>
                <View>
                  <Text style={styles.scoreLabel}>ATS score</Text>
                  <Text style={styles.scoreValue}>{resumeAnalysis.ats_score.toFixed(0)}/100</Text>
                </View>
                <View style={styles.verdictBadge}>
                  <Text style={styles.verdictText}>{resumeAnalysis.verdict.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.summaryText}>{resumeAnalysis.final_feedback}</Text>
            </View>

            <View style={styles.insightCard}>
              <Text style={styles.insightTitle}>Strengths</Text>
              {resumeAnalysis.strengths.map((item) => (
                <Text key={item} style={styles.bullet}>{`- ${item}`}</Text>
              ))}
            </View>

            <View style={styles.insightCard}>
              <Text style={styles.insightTitle}>Weaknesses</Text>
              {resumeAnalysis.weaknesses.map((item) => (
                <Text key={item} style={styles.bullet}>{`- ${item}`}</Text>
              ))}
            </View>

            <View style={styles.insightCard}>
              <Text style={styles.insightTitle}>Missing keywords</Text>
              <View style={styles.keywordWrap}>
                {resumeAnalysis.missing_keywords.length ? (
                  resumeAnalysis.missing_keywords.map((item) => (
                    <View key={item} style={styles.keywordChip}>
                      <Text style={styles.keywordText}>{item}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyInline}>No obvious keyword gaps found.</Text>
                )}
              </View>
            </View>

            <View style={styles.insightCard}>
              <Text style={styles.insightTitle}>Improvements</Text>
              {resumeAnalysis.improvements.map((item) => (
                <Text key={item} style={styles.bullet}>{`- ${item}`}</Text>
              ))}
            </View>

            <View style={styles.insightCard}>
              <View style={styles.exampleHeader}>
                <Sparkles color={colors.brand} size={16} />
                <Text style={styles.insightTitle}>Rewrite examples</Text>
              </View>
              {resumeAnalysis.rewritten_examples.length ? (
                resumeAnalysis.rewritten_examples.map((item, index) => (
                  <View key={`${item.original}-${index}`} style={styles.exampleBlock}>
                    <Text style={styles.exampleLabel}>Original</Text>
                    <Text style={styles.exampleText}>{item.original}</Text>
                    <Text style={[styles.exampleLabel, styles.exampleLabelSpacer]}>Improved</Text>
                    <Text style={styles.exampleTextStrong}>{item.improved}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyInline}>No rewrite examples returned.</Text>
              )}
            </View>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <FileSearch color={colors.brand} size={24} />
            <Text style={styles.emptyTitle}>No analysis yet</Text>
            <Text style={styles.emptyText}>Upload a resume file and the app will extract text, score ATS readiness, flag missing keywords, and rewrite weak bullets.</Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  header: {
    marginBottom: 6,
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
    color: colors.text,
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: 16,
    shadowColor: colors.text,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  label: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  labelHint: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
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
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 12,
  },
  helper: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  fileCard: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  fileIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  fileCopy: {
    flex: 1,
  },
  fileName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  fileMeta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  error: {
    color: colors.danger,
    lineHeight: 20,
  },
  scoreCard: {
    borderRadius: 24,
    backgroundColor: colors.dark,
    padding: 18,
  },
  scoreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  scoreLabel: {
    color: "#BFDBFE",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  scoreValue: {
    marginTop: 6,
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
  },
  verdictBadge: {
    borderRadius: 999,
    backgroundColor: "#1D4ED8",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  verdictText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  summaryText: {
    marginTop: 14,
    color: "#E2E8F0",
    fontSize: 14,
    lineHeight: 22,
  },
  insightCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: 16,
  },
  insightTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
  },
  bullet: {
    color: "#334155",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
  },
  keywordWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  keywordChip: {
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  keywordText: {
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "700",
  },
  exampleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  exampleBlock: {
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: 14,
    marginBottom: 10,
  },
  exampleLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  exampleLabelSpacer: {
    marginTop: 10,
  },
  exampleText: {
    marginTop: 6,
    color: "#475569",
    fontSize: 14,
    lineHeight: 21,
  },
  exampleTextStrong: {
    marginTop: 6,
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
  },
  emptyCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 18,
  },
  emptyTitle: {
    marginTop: 10,
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyText: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  emptyInline: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
});
