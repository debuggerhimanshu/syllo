import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { recognizeText } from "expo-ocr-kit";
import { supabase } from "../lib/supabase";
import { extractFFCSFromOCRBlocks } from "../lib/ffcs/extractor";
import { buildParsedCourses } from "../lib/ffcs/parser";
import type { FFCSOCRBlock } from "../lib/ffcs/extractor";
type ParsedCourse = ReturnType<typeof buildParsedCourses>[number];
type ParsedClass = ParsedCourse["classes"][number];
const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export default function ProcessingFFCS() {
  const { uri, name, mimeType } = useLocalSearchParams<{
    uri?: string;
    name?: string;
    mimeType?: string;
  }>();
  const [status, setStatus] = useState("Preparing OCR...");
  const [recognizedText, setRecognizedText] = useState("");
  const [blockCount, setBlockCount] = useState(0);
  const [copying, setCopying] = useState(false);
  const [courses, setCourses] = useState<ParsedCourse[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);
  useEffect(() => {
    let active = true;
    async function runOCR() {
      if (!uri || typeof uri !== "string") {
        setStatus("No image was received.");
        return;
      }
      if (mimeType === "application/pdf") {
        setStatus(
          "PDF OCR is not supported yet. Please upload a VTOP screenshot."
        );
        return;
      }
      try {
        setStatus("Recognizing text from screenshot...");
        setExtracting(true);
        setCourses([]);
        setWarnings([]);
        setRecognizedText("");
        setBlockCount(0);
        setReviewMode(false);
        setConfirmed(false);
        setImportComplete(false);
        const result = await recognizeText(uri);
        if (!active) return;
        setRecognizedText(result.text);
        setBlockCount(result.blocks.length);
        const extraction = extractFFCSFromOCRBlocks(
          result.blocks as FFCSOCRBlock[]
        );
        const parsed = buildParsedCourses(
          extraction.courses,
          extraction.heatmapCells
        );
        if (!active) return;
        setCourses(parsed);
        setWarnings(extraction.warnings);
        setStatus(
          extraction.courses.length > 0
            ? "OCR and timetable extraction completed."
            : "OCR completed, but no courses were detected."
        );
        console.log("FFCS parsed timetable:", parsed);
        console.log("FFCS warnings:", extraction.warnings);
      } catch (error) {
        console.error("FFCS OCR/extraction error:", error);
        if (active) {
          setStatus(
            error instanceof Error
              ? `Processing failed: ${error.message}`
              : "Processing failed. Check the development logs."
          );
        }
      } finally {
        if (active) setExtracting(false);
      }
    }
    void runOCR();
    return () => {
      active = false;
    };
  }, [uri, mimeType]);
  const classCount = useMemo(
    () =>
      courses.reduce(
        (total, course) => total + course.classes.length,
        0
      ),
    [courses]
  );
  const updateClass = (
    courseCode: string,
    classIndex: number,
    update: Partial<ParsedClass>
  ) => {
    setConfirmed(false);
    setImportComplete(false);
    setCourses((current) =>
      current.map((course) =>
        course.code !== courseCode
          ? course
          : {
              ...course,
              classes: course.classes.map((item, index) =>
                index === classIndex ? { ...item, ...update } : item
              ),
            }
      )
    );
  };
  const changeDay = (
    courseCode: string,
    classIndex: number,
    direction: -1 | 1
  ) => {
    const course = courses.find((item) => item.code === courseCode);
    const item = course?.classes[classIndex];
    if (!item) return;
    const currentDay = Math.max(1, Math.min(6, item.weekday));
    const nextDay = ((currentDay - 1 + direction + 6) % 6) + 1;
    updateClass(courseCode, classIndex, {
      weekday: nextDay,
    });
  };
  const removeClass = (courseCode: string, classIndex: number) => {
    Alert.alert(
      "Remove class?",
      "This removes the entry from this review only. It does not delete an existing database record.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setConfirmed(false);
            setImportComplete(false);
            setCourses((current) =>
              current.map((course) =>
                course.code !== courseCode
                  ? course
                  : {
                      ...course,
                      classes: course.classes.filter(
                        (_, index) => index !== classIndex
                      ),
                    }
              )
            );
          },
        },
      ]
    );
  };
  const copyText = async (text: string, label: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert("Copied!", `${label} copied to clipboard.`);
    } catch (error) {
      console.error("Clipboard error:", error);
      Alert.alert("Copy failed", "Unable to copy to the clipboard.");
    }
  };
  const copyOCRText = async () => {
    if (!recognizedText.trim()) {
      Alert.alert("Nothing to copy", "No OCR text is available yet.");
      return;
    }
    setCopying(true);
    try {
      await Clipboard.setStringAsync(recognizedText);
      Alert.alert("Copied!", "Recognized OCR text copied.");
    } catch (error) {
      console.error("Clipboard error:", error);
      Alert.alert("Copy failed", "Unable to copy the OCR text.");
    } finally {
      setCopying(false);
    }
  };
  const copyTimetable = () => {
    if (!courses.length) {
      Alert.alert("Nothing to copy", "No parsed courses are available.");
      return;
    }
    void copyText(
      JSON.stringify(courses, null, 2),
      "Reviewed timetable"
    );
  };
  const confirmReview = () => {
    Alert.alert(
      "Confirm timetable review?",
      `You've reviewed ${classCount} class entries across ${courses.length} courses.${
        warnings.length > 0
          ? `\n\n${warnings.length} extraction warning(s) remain. Courses with no detected classes will be skipped during import.`
          : ""
      }\n\nNothing will be saved until you tap Import to Syllo.`,
      [
        { text: "Keep reviewing", style: "cancel" },
        {
          text: "Confirm review",
          onPress: () => {
            setConfirmed(true);
            setReviewMode(false);
            setImportComplete(false);
            setStatus("Review confirmed. Ready to import.");
          },
        },
      ]
    );
  };
  const importTimetable = async () => {
    if (importing) return;
    if (!confirmed) {
      Alert.alert(
        "Review required",
        "Please review and confirm your timetable first."
      );
      return;
    }
    const importableCourses = courses.filter(
      (course) => course.classes.length > 0
    );
    const skippedCourses = courses.filter(
      (course) => course.classes.length === 0
    );
    if (importableCourses.length === 0) {
      Alert.alert(
        "No classes to import",
        "No courses contain scheduled classes. Review your extracted timetable first."
      );
      return;
    }
    // Validate the complete batch before making database changes.
    for (const course of importableCourses) {
      for (const item of course.classes) {
        const validStart = /^([01]\d|2[0-3]):[0-5]\d$/.test(
          item.start_time
        );
        const validEnd = /^([01]\d|2[0-3]):[0-5]\d$/.test(
          item.end_time
        );
        if (
          !Number.isInteger(item.weekday) ||
          item.weekday < 1 ||
          item.weekday > 7 ||
          !validStart ||
          !validEnd ||
          item.start_time >= item.end_time ||
          !item.slot?.trim()
        ) {
          Alert.alert(
            "Invalid class entry",
            `${course.code} contains an invalid weekday, time, or slot. Correct it before importing.`
          );
          return;
        }
      }
    }
    setImporting(true);
    setImportComplete(false);
    let inserted = 0;
    let skippedDuplicates = 0;
    const errors: string[] = [];
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        Alert.alert(
          "Sign-in required",
          "Please sign in again before importing your timetable."
        );
        return;
      }
      for (const course of importableCourses) {
        // Only find courses owned by the signed-in user.
        const { data: matchingCourses, error: courseLookupError } =
          await supabase
            .from("courses")
            .select("id, name, code")
            .eq("user_id", user.id)
            .eq("code", course.code)
            .limit(2);
        if (courseLookupError) {
          errors.push(
            `${course.code}: ${courseLookupError.message}`
          );
          continue;
        }
        if ((matchingCourses?.length ?? 0) > 1) {
          errors.push(
            `${course.code}: multiple matching courses exist. Resolve the duplicates before importing.`
          );
          continue;
        }
        let courseId: string | undefined =
          matchingCourses?.[0]?.id;
        if (!courseId) {
          const { data: createdCourse, error: createCourseError } =
            await supabase
              .from("courses")
              .insert({
                user_id: user.id,
                name: course.name,
                code: course.code,
                faculty: course.faculty ?? null,
                color: "#8B5CF6",
              })
              .select("id")
              .single();
          if (createCourseError || !createdCourse?.id) {
            errors.push(
              `${course.code}: ${
                createCourseError?.message ??
                "Could not create the course."
              }`
            );
            continue;
          }
          courseId = createdCourse.id;
        }
        // Guard against an unresolved course ID before querying/inserting classes.
        if (!courseId) {
          errors.push(`${course.code}: could not determine the course ID.`);
          continue;
        }
        const { data: existingClasses, error: classLookupError } =
          await supabase
            .from("classes")
            .select("weekday, start_time, end_time, slot")
            .eq("course_id", courseId);
        if (classLookupError) {
          errors.push(
            `${course.code}: could not check existing classes: ${classLookupError.message}`
          );
          continue;
        }
const seenInThisImport = new Set<string>();
const pendingClasses = course.classes.filter((item) => {
  const normalizeTime = (value: string) => value.trim().slice(0, 5);
  const normalizeSlot = (value: string | null | undefined) =>
    (value ?? "").trim().toUpperCase();
  const key = [
    item.weekday,
    normalizeTime(item.start_time),
    normalizeTime(item.end_time),
    normalizeSlot(item.slot),
  ].join("|");
  // Skip duplicate entries within this import.
  if (seenInThisImport.has(key)) {
    skippedDuplicates += 1;
    return false;
  }
  seenInThisImport.add(key);
  // Skip classes that already exist in Supabase.
  const duplicate = (existingClasses ?? []).some(
    (existing) =>
      existing.weekday === item.weekday &&
      normalizeTime(existing.start_time) === normalizeTime(item.start_time) &&
      normalizeTime(existing.end_time) === normalizeTime(item.end_time) &&
      normalizeSlot(existing.slot) === normalizeSlot(item.slot)
  );
  if (duplicate) {
    skippedDuplicates += 1;
    return false;
  }
  return true;
});
        if (pendingClasses.length === 0) continue;
        const rows = pendingClasses.map((item) => ({
          course_id: courseId,
          weekday: item.weekday,
          start_time: item.start_time,
          end_time: item.end_time,
          room: item.room ?? null,
          slot: item.slot,
        }));
        const { data: insertedRows, error: insertError } =
        await supabase
          .from("classes")
          .upsert(rows, {
            onConflict:
              "course_id,weekday,start_time,end_time,slot,valid_from,valid_until",
            ignoreDuplicates: true,
          })
          .select("id");
        if (insertError) {
          errors.push(
            `${course.code}: failed to insert classes: ${insertError.message}`
          );
          continue;
        }
        inserted += insertedRows?.length ?? rows.length;
      }
      setImportComplete(errors.length === 0);
      const summary = [
        `New classes imported: ${inserted}`,
        `Existing duplicates skipped: ${skippedDuplicates}`,
        `Courses without classes skipped: ${skippedCourses.length}`,
        `Errors: ${errors.length}`,
      ].join("\n");
      setStatus(
        errors.length === 0
          ? "Timetable import completed."
          : "Timetable import completed with some errors."
      );
      Alert.alert(
        errors.length === 0 ? "Import successful" : "Import finished with errors",
        `${summary}${
          errors.length > 0
            ? `\n\n${errors.slice(0, 5).join("\n")}`
            : ""
        }`
      );
    } catch (error) {
      console.error("FFCS import error:", error);
      setStatus("An unexpected error occurred during import.");
      Alert.alert(
        "Import failed",
        error instanceof Error
          ? error.message
          : "An unexpected error occurred."
      );
    } finally {
      setImporting(false);
    }
  };
    return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>SYLLO · TIMETABLE IMPORT</Text>
      <Text style={styles.title}>
        {reviewMode ? "Review timetable" : "FFCS Import"}
      </Text>
      <Text style={styles.subtitle}>
        {typeof name === "string" ? name : "Selected timetable"}
      </Text>
      <View style={styles.statusCard}>
        {extracting || importing ? (
          <ActivityIndicator color="#A78BFA" />
        ) : (
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: status.startsWith("Processing failed")
                  ? "#EF4444"
                  : confirmed
                    ? "#22C55E"
                    : "#A78BFA",
              },
            ]}
          />
        )}
        <Text style={styles.statusText}>{status}</Text>
      </View>
      {blockCount > 0 && (
        <View style={styles.statsRow}>
          <Stat label="OCR blocks" value={blockCount} />
          <Stat label="Courses" value={courses.length} />
          <Stat label="Classes" value={classCount} />
        </View>
      )}
      {warnings.length > 0 && (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>
            Review required ({warnings.length})
          </Text>
          {warnings.map((warning, index) => (
            <Text
              key={`${warning}-${index}`}
              style={styles.warningText}
            >
              • {warning}
            </Text>
          ))}
        </View>
      )}
      {courses.length > 0 && (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View style={styles.flex}>
              <Text style={styles.panelTitle}>Extracted courses</Text>
              <Text style={styles.muted}>
                {reviewMode
                  ? "Correct the weekday or remove incorrect entries."
                  : "Check the extracted entries before continuing."}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.smallButton}
              onPress={copyTimetable}
            >
              <Text style={styles.buttonText}>Copy JSON</Text>
            </TouchableOpacity>
          </View>
          {courses.map((course) => (
            <View key={course.code} style={styles.courseCard}>
              <Text style={styles.courseCode}>{course.code}</Text>
              <Text style={styles.courseName}>{course.name}</Text>
              <Text style={styles.muted}>
                Faculty: {course.faculty ?? "Unknown"}
              </Text>
              {course.classes.length === 0 ? (
                <Text style={styles.emptyText}>
                  No scheduled classes detected. Check this course manually.
                </Text>
              ) : (
                course.classes.map((item, index) => (
                  <View
                    key={`${course.code}-${index}-${item.slot}`}
                    style={styles.classCard}
                  >
                    <View style={styles.classTopRow}>
                      <Text style={styles.slot}>{item.slot}</Text>
                      <Text style={styles.classTime}>
                        {item.start_time}–{item.end_time}
                      </Text>
                    </View>
                    <Text style={styles.classDetails}>
                      {DAYS[item.weekday - 1] ?? `Day ${item.weekday}`}{" "}
                      · {item.room ?? "Room unknown"}
                    </Text>
                    {reviewMode && (
                      <View style={styles.actionsRow}>
                        <TouchableOpacity
                          style={styles.dayButton}
                          onPress={() =>
                            changeDay(course.code, index, -1)
                          }
                        >
                          <Text style={styles.dayButtonText}>
                            ‹ Day
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.editHint}>
                          Change weekday
                        </Text>
                        <TouchableOpacity
                          style={styles.dayButton}
                          onPress={() =>
                            changeDay(course.code, index, 1)
                          }
                        >
                          <Text style={styles.dayButtonText}>
                            Day ›
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() =>
                            removeClass(course.code, index)
                          }
                        >
                          <Text style={styles.removeText}>
                            Remove
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          ))}
        </View>
      )}
      {courses.length > 0 && (
        <View style={styles.bottomActions}>
          {!reviewMode && !confirmed && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setReviewMode(true)}
            >
              <Text style={styles.primaryButtonText}>
                Review classes →
              </Text>
            </TouchableOpacity>
          )}
          {reviewMode && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={confirmReview}
            >
              <Text style={styles.primaryButtonText}>
                Confirm review →
              </Text>
            </TouchableOpacity>
          )}
          {confirmed && (
            <View style={styles.confirmedCard}>
              <Text style={styles.confirmedTitle}>
                {importComplete
                  ? "Import completed"
                  : "Review confirmed"}
              </Text>
              <Text style={styles.muted}>
                {importComplete
                  ? "The import completed without reported errors. Courses with no detected classes were skipped."
                  : "Your reviewed timetable is ready to import. Courses without detected classes will be skipped."}
              </Text>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  importing && { opacity: 0.6 },
                ]}
                onPress={importTimetable}
                disabled={importing || importComplete}
              >
                {importing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {importComplete
                      ? "Import completed"
                      : "Import to Syllo"}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setConfirmed(false);
                  setImportComplete(false);
                  setReviewMode(true);
                }}
                disabled={importing}
              >
                <Text style={styles.secondaryButtonText}>
                  Review again
                </Text>
              </TouchableOpacity>

              {importComplete && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.replace("/(tabs)/schedule")}
              >
                <Text style={styles.primaryButtonText}>
                  Back to Schedule
                </Text>
              </TouchableOpacity>
            )}

            </View>
          )}
        </View>
      )}
      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Recognized OCR text</Text>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={copyOCRText}
            disabled={!recognizedText.trim() || copying}
          >
            <Text style={styles.buttonText}>
              {copying ? "Copying..." : "Copy text"}
            </Text>
          </TouchableOpacity>
        </View>
        <Text selectable style={styles.ocrText}>
          {recognizedText || "Waiting for OCR output..."}
        </Text>
      </View>
    </ScrollView>
  );
}
function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08090D",
  },
  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  flex: {
    flex: 1,
  },
  eyebrow: {
    color: "#A78BFA",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  title: {
    color: "#F5F7FA",
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "#9CA3AF",
    marginTop: 8,
    fontSize: 13,
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#111318",
    padding: 16,
    borderRadius: 14,
    marginTop: 24,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    color: "#F5F7FA",
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#242630",
  },
  statValue: {
    color: "#A78BFA",
    fontSize: 21,
    fontWeight: "800",
  },
  statLabel: {
    color: "#9CA3AF",
    fontSize: 10,
    marginTop: 4,
  },
  panel: {
    backgroundColor: "#111318",
    borderRadius: 16,
    padding: 16,
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#22242D",
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  panelTitle: {
    color: "#F5F7FA",
    fontSize: 17,
    fontWeight: "800",
  },
  muted: {
    color: "#9CA3AF",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  smallButton: {
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  courseCard: {
    borderTopWidth: 1,
    borderTopColor: "#272932",
    paddingTop: 14,
    paddingBottom: 6,
    marginTop: 10,
  },
  courseCode: {
    color: "#A78BFA",
    fontSize: 13,
    fontWeight: "800",
  },
  courseName: {
    color: "#F5F7FA",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 3,
  },
  emptyText: {
    color: "#FBBF24",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  classCard: {
    backgroundColor: "#191B23",
    borderRadius: 11,
    padding: 12,
    marginTop: 10,
  },
  classTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  slot: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
  },
  classTime: {
    color: "#C4B5FD",
    fontSize: 12,
    fontWeight: "600",
  },
  classDetails: {
    color: "#B8BCC8",
    fontSize: 12,
    marginTop: 6,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 12,
  },
  dayButton: {
    backgroundColor: "#29213F",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dayButtonText: {
    color: "#DDD6FE",
    fontWeight: "700",
    fontSize: 11,
  },
  editHint: {
    color: "#9CA3AF",
    fontSize: 10,
  },
  removeButton: {
    marginLeft: "auto",
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  removeText: {
    color: "#F87171",
    fontWeight: "700",
    fontSize: 11,
  },
  warningCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#291D12",
    borderWidth: 1,
    borderColor: "#573B1B",
    gap: 8,
  },
  warningTitle: {
    color: "#FBBF24",
    fontSize: 14,
    fontWeight: "800",
  },
  warningText: {
    color: "#FDE68A",
    fontSize: 12,
    lineHeight: 18,
  },
  bottomActions: {
    marginTop: 18,
  },
  primaryButton: {
    backgroundColor: "#8B5CF6",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 13,
    alignItems: "center",
    marginTop: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  confirmedCard: {
    backgroundColor: "#10251D",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#20543E",
    padding: 16,
  },
  confirmedTitle: {
    color: "#86EFAC",
    fontWeight: "800",
    fontSize: 16,
  },
  secondaryButton: {
    marginTop: 14,
    alignSelf: "flex-start",
    backgroundColor: "#1D3A2D",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: "#BBF7D0",
    fontSize: 12,
    fontWeight: "700",
  },
  ocrText: {
    color: "#C5C9D3",
    fontSize: 12,
    lineHeight: 20,
  },
});
