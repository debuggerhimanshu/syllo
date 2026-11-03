import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Redirect, router, useFocusEffect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  getClassAlarmSettings,
  saveClassAlarmSettings,
  type ClassAlarmSettings,
} from "@/lib/alarm-settings";
import { getLocalSchedule } from "@/lib/timetable-repository";
import { syncClassAlarms } from "@/lib/class-alarms";

type Course = {
  id: string;
  name: string;
  code: string | null;
  faculty: string | null;
  color: string | null;
};

type ClassItem = {
  id: string;
  course_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  room: string | null;
  course: Course | null;
};

const COLORS = {
  background: "#08090D",
  card: "#11131A",
  cardLight: "#191B25",
  purple: "#8B5CF6",
  text: "#F5F7FA",
  muted: "#8F95A3",
  border: "#252735",
  green: "#4ADE80",
};

function formatTime(value: string) {
  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return value;
  }

  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function formatRange(start: string, end: string) {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function getMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getDateLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function HomeScreen() {
  const { session, loading, signOut } = useAuth();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [alarmSettings, setAlarmSettings] = useState<ClassAlarmSettings>({});
  const [savingAlarmId, setSavingAlarmId] = useState<string | null>(null);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  
const fetchClasses = useCallback(async (isRefresh = false) => {
  if (!session?.user?.id) return;

  if (isRefresh) {
    setRefreshing(true);
  } else {
    setFetching(true);
  }

  setError(null);

  try {
    const currentDate = new Date();

    const weekday =
      currentDate.getDay() === 0
        ? 7
        : currentDate.getDay();

    // Read the complete timetable from SQLite.
    const localSchedule = await getLocalSchedule(
      session.user.id
    );

    // Display only today's classes.
    const todayClasses: ClassItem[] = localSchedule
      .filter((item) => item.weekday === weekday)
      .map((item) => ({
        id: item.id,
        course_id: item.course_id,
        weekday: item.weekday,
        start_time: item.start_time,
        end_time: item.end_time,
        room: item.room,
        course: item.course,
      }));

    setClasses(todayClasses);
    setNow(new Date());
  } catch (err) {
    console.error("Local home timetable error:", err);

    setError(
      "Couldn't load your timetable. Please try again."
    );
  } finally {
    setFetching(false);
    setRefreshing(false);
  }
}, [session?.user?.id]);


  useFocusEffect(
    useCallback(() => {
      let active = true;

      getClassAlarmSettings()
        .then((settings) => {
          if (active) setAlarmSettings(settings);
        })
        .catch((error) => {
          console.error("Failed to load class alarm settings:", error);
        });

      return () => {
        active = false;
      };
    }, [])
  );

  

const toggleClassAlarm = useCallback(async (classId: string) => {
  if (savingAlarmId || !session?.user?.id) return;

  const previous = alarmSettings;
  const next: ClassAlarmSettings = {
    ...previous,
    [classId]: !(previous[classId] ?? false),
  };

  setAlarmSettings(next);
  setSavingAlarmId(classId);

  try {
    await saveClassAlarmSettings(next);

    // Read all classes from local SQLite storage.
    const localSchedule = await getLocalSchedule(session.user.id);

    const alarmClasses = localSchedule.map((item) => ({
      id: item.id,
      weekday: item.weekday,
      start_time: item.start_time,
      valid_from: item.valid_from,
      valid_until: item.valid_until,
      course: item.course
        ? {
            name: item.course.name,
            code: item.course.code,
          }
        : null,
    }));

    const result = await syncClassAlarms(alarmClasses, next);

    if (result.permissionDenied && next[classId]) {
      Alert.alert(
        "Notifications disabled",
        "Enable notifications for Syllo in Android Settings to receive class alarms.",
      );
    } else {
      Alert.alert(
        next[classId] ? "Alarm enabled" : "Alarm disabled",
        next[classId]
          ? "Your class alarm is scheduled for 5 minutes before class."
          : "The alarm setting has been updated.",
      );
    }
  } catch (error) {
    console.error("Failed to update class alarm:", error);

    try {
      await saveClassAlarmSettings(previous);
    } catch (saveError) {
      console.error("Failed to restore alarm settings:", saveError);
    }

    setAlarmSettings(previous);
    Alert.alert(
      "Couldn't update alarm",
      "Please check your connection and try again.",
    );
  } finally {
    setSavingAlarmId(null);
  }
}, [alarmSettings, savingAlarmId, session?.user?.id]);



  useFocusEffect(
    useCallback(() => {
      if (session) {
        setNow(new Date());
        fetchClasses();
      }
    }, [session, fetchClasses])
  );

  const { currentClass, nextClass, remainingClasses } = useMemo(() => {
    const active = classes.find(
      (item) =>
        getMinutes(item.start_time) <= currentMinutes &&
        currentMinutes < getMinutes(item.end_time)
    );

    const upcoming = classes.filter(
      (item) => getMinutes(item.start_time) > currentMinutes
    );

    return {
      currentClass: active ?? null,
      nextClass: upcoming[0] ?? null,
      remainingClasses: upcoming,
    };
  }, [classes, currentMinutes]);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace("/auth");
    } catch {
      Alert.alert("Sign out failed", "Please try again.");
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.purple} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/auth" />;
  }

  const featuredClass = currentClass ?? nextClass;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.background}
        translucent={false}
      />

      <ScrollContent
        fetching={fetching}
        refreshing={refreshing}
        error={error}
        classes={classes}
        currentClass={currentClass}
        featuredClass={featuredClass}
        remainingClasses={remainingClasses}
        onRefresh={() => fetchClasses(true)}
        onRetry={() => fetchClasses()}
        onSignOut={handleSignOut}
        alarmSettings={alarmSettings}
        savingAlarmId={savingAlarmId}
        onToggleAlarm={toggleClassAlarm}
      />
    </SafeAreaView>
  );
}

function ScrollContent({
  fetching,
  refreshing,
  error,
  classes,
  currentClass,
  featuredClass,
  remainingClasses,
  onRefresh,
  onRetry,
  onSignOut,
  alarmSettings,
  savingAlarmId,
  onToggleAlarm,
}: {
  fetching: boolean;
  refreshing: boolean;
  error: string | null;
  classes: ClassItem[];
  currentClass: ClassItem | null;
  featuredClass: ClassItem | null;
  remainingClasses: ClassItem[];
  onRefresh: () => void;
  onRetry: () => void;
  onSignOut: () => void;
  alarmSettings: ClassAlarmSettings;
  savingAlarmId: string | null;
  onToggleAlarm: (classId: string) => void;
}) {

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.purple}
            colors={[COLORS.purple]}
            progressBackgroundColor={COLORS.card}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>YOUR STUDENT SPACE</Text>
            <Text style={styles.greeting}>{getGreeting()} </Text>
            <Text style={styles.date}>{getDateLabel()}</Text>

          </View>

          <TouchableOpacity
            style={styles.avatar}
            onPress={onSignOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Text style={styles.avatarText}>S</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionText}>
            <Text style={styles.sectionTitle}>Your day</Text>
            <Text style={styles.sectionSubtitle}>
              Here's what's on your schedule.
            </Text>
          </View>

          <View style={styles.todayBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.todayBadgeText}>TODAY</Text>
          </View>
        </View>

        {fetching ? (
          <View style={[styles.heroCard, styles.loadingCard]}>
            <ActivityIndicator size="large" color={COLORS.purple} />
            <Text style={styles.loadingText}>Loading your classes...</Text>
          </View>
        ) : error ? (
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>Something went wrong</Text>
            <Text style={styles.heroDescription}>{error}</Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onRetry}
            >
              <Text style={styles.primaryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : featuredClass ? (
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroLabel}>
                <View style={styles.liveDot} />
                <Text style={styles.heroLabelText}>
                  {currentClass ? "HAPPENING NOW" : "UP NEXT"}
                </Text>
              </View>

              <Text style={styles.classCount}>
                {classes.length}{" "}
                {classes.length === 1 ? "CLASS" : "CLASSES"}
              </Text>
            </View>

            <View style={styles.heroAccent} />

            <Text style={styles.heroTitle}>
              {featuredClass.course?.name ?? "Untitled course"}
            </Text>

            {!!featuredClass.course?.code && (
              <Text style={styles.courseCode}>
                {featuredClass.course.code}
              </Text>
            )}

            <View style={styles.heroTimeRow}>
              <View style={styles.timeIcon}>
                <Text style={styles.timeIconText}>◷</Text>
              </View>

              <View style={styles.timeDetails}>
                <Text style={styles.timeLabel}>CLASS TIMING</Text>
                <Text style={styles.heroTime}>
                  {formatRange(
                    featuredClass.start_time,
                    featuredClass.end_time
                  )}
                </Text>
              </View>
            </View>

            {!!featuredClass.room && (
              <View style={styles.roomRow}>
                <Text style={styles.roomIcon}>⌖</Text>
                <Text style={styles.roomText}>{featuredClass.room}</Text>
              </View>
            )}

            {!!featuredClass.course?.faculty && (
              <Text style={styles.facultyText}>
                Faculty · {featuredClass.course.faculty}
              </Text>
            )}

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() =>
                router.push({
                  pathname: "/class-details",
                  params: { id: featuredClass.id },
                })
              }
            >
              <Text style={styles.secondaryButtonText}>
                View class details
              </Text>
              <Text style={styles.arrow}>↗</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.heroCard}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>✦</Text>
            </View>

            <Text style={styles.heroTitle}>You're all caught up!</Text>

            <Text style={styles.heroDescription}>
              {classes.length > 0
                ? "No more classes for today. Take a breath and make some progress on your goals."
                : "No classes found for today. Import your FFCS timetable or add a class to get started."}
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push("/add-class")}
            >
              <Text style={styles.primaryButtonText}>+ Add a class</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.textButton}
              onPress={() => router.push("/import-ffcs")}
            >
              <Text style={styles.textButtonText}>
                Import FFCS timetable →
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.upcomingHeader}>
          <View style={styles.sectionText}>
            <Text style={styles.sectionTitle}>Coming up</Text>
            <Text style={styles.sectionSubtitle}>
              {remainingClasses.length > 0
                ? `${remainingClasses.length} class${remainingClasses.length === 1 ? "" : "es"} remaining today`
                : "Your remaining schedule"}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => router.push("/schedule")}
            style={styles.viewAllButton}
          >
            <Text style={styles.viewAllText}>View all →</Text>
          </TouchableOpacity>
        </View>

        {!fetching && !error && remainingClasses.length > 0 ? (
          <View style={styles.upcomingList}>
            {remainingClasses.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.classRow}
                onPress={() =>
                  router.push({
                    pathname: "/class-details",
                    params: { id: item.id },
                  })
                }
                activeOpacity={0.75}
              >
                <View style={styles.classTime}>
                  <Text style={styles.classStart}>
                    {formatTime(item.start_time)}
                  </Text>
                  <Text style={styles.classEnd}>
                    {formatTime(item.end_time)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.classColorBar,
                    {
                      backgroundColor:
                        item.course?.color ?? COLORS.purple,
                    },
                  ]}
                />

                <TouchableOpacity
                  style={styles.classInfo}
                  onPress={() =>
                    router.push({
                      pathname: "/class-details",
                      params: { id: item.id },
                    })
                  }
                  activeOpacity={0.75}
                >
                  <Text style={styles.className} numberOfLines={1}>
                    {item.course?.name ?? "Untitled course"}
                  </Text>
                  <Text style={styles.classMeta} numberOfLines={1}>
                    {item.course?.code ?? "Course"}
                    {item.room ? ` · ${item.room}` : ""}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.alarmToggle,
                    alarmSettings[item.id] && styles.alarmToggleActive,
                  ]}
                  onPress={() => onToggleAlarm(item.id)}
                  disabled={savingAlarmId === item.id}
                  accessibilityRole="switch"
                  accessibilityState={{
                    checked: alarmSettings[item.id] ?? false,
                    disabled: savingAlarmId === item.id,
                  }}
                  accessibilityLabel={`Alarm for ${item.course?.name ?? "class"}`}
                >
                  <Text
                    style={[
                      styles.alarmToggleText,
                      alarmSettings[item.id] && styles.alarmToggleTextActive,
                    ]}
                  >
                    {savingAlarmId === item.id
                      ? "..."
                      : alarmSettings[item.id]
                        ? "ALARM ON"
                        : "ALARM OFF"}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        ) : !fetching && !error ? (
          <View style={styles.smallEmptyCard}>
            <Text style={styles.smallEmptyTitle}>
              No more classes today
            </Text>
            <Text style={styles.smallEmptyText}>
              {currentClass
                ? "Focus on your current class. You've got this!"
                : "A little free time can go a long way."}
            </Text>
          </View>
        ) : null}

        <View style={styles.quickActionsHeader}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/add-class")}
          >
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>＋</Text>
            </View>
            <Text style={styles.actionTitle}>Add class</Text>
            <Text style={styles.actionDescription}>
              Update your timetable
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/import-ffcs")}
          >
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>↥</Text>
            </View>
            <Text style={styles.actionTitle}>Import FFCS</Text>
            <Text style={styles.actionDescription}>
              Sync your schedule
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>MADE FOR YOUR NEXT BIG THING ✦</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop:
      Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 36,
  },
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  eyebrow: {
    color: COLORS.purple,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 9,
  },
  greeting: {
    color: COLORS.text,
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  date: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 6,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#211A35",
    borderWidth: 1,
    borderColor: "#4A3476",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#C4B5FD",
    fontSize: 19,
    fontWeight: "800",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionText: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 5,
  },
  todayBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#171B20",
    borderWidth: 1,
    borderColor: "#29332F",
  },
  todayBadgeText: {
    color: COLORS.green,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.green,
  },
  heroCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    marginBottom: 32,
    overflow: "hidden",
  },
  loadingCard: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: COLORS.muted,
    marginTop: 14,
    fontSize: 13,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroLabelText: {
    color: COLORS.green,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  classCount: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.7,
  },
  heroAccent: {
    width: 44,
    height: 4,
    borderRadius: 4,
    backgroundColor: COLORS.purple,
    marginTop: 23,
    marginBottom: 18,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 31,
    letterSpacing: -0.6,
  },
  courseCode: {
    color: "#B7A0FF",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 7,
  },
  heroTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 25,
  },
  timeIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#211A35",
    alignItems: "center",
    justifyContent: "center",
  },
  timeIconText: {
    color: "#C4B5FD",
    fontSize: 25,
  },
  timeDetails: {
    flexShrink: 1,
  },
  timeLabel: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 5,
  },
  heroTime: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },
  roomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 17,
    gap: 8,
  },
  roomIcon: {
    color: "#C4B5FD",
    fontSize: 18,
  },
  roomText: {
    color: "#C8CBD5",
    fontSize: 13,
    fontWeight: "600",
  },
  facultyText: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 12,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.cardLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    paddingVertical: 14,
    marginTop: 22,
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  arrow: {
    color: "#C4B5FD",
    fontSize: 16,
  },
  heroDescription: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 10,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#211A35",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyIconText: {
    color: "#C4B5FD",
    fontSize: 25,
  },
  primaryButton: {
    backgroundColor: COLORS.purple,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginTop: 20,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  textButton: {
    alignItems: "center",
    paddingVertical: 14,
  },
  textButtonText: {
    color: "#C4B5FD",
    fontSize: 12,
    fontWeight: "700",
  },
  upcomingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  viewAllButton: {
    paddingVertical: 8,
    paddingLeft: 8,
  },
  viewAllText: {
    color: "#B7A0FF",
    fontSize: 12,
    fontWeight: "700",
  },
  upcomingList: {
    gap: 10,
    marginBottom: 32,
  },
  classRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    minHeight: 82,
  },
  classTime: {
    width: 76,
  },
  classStart: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
  },
  classEnd: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 5,
  },
  classColorBar: {
    width: 3,
    height: 40,
    borderRadius: 3,
    marginRight: 13,
  },
  classInfo: {
    flex: 1,
    minWidth: 0,
  },
  className: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  classMeta: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 6,
  },
  alarmToggle: {
    marginLeft: 8,
    paddingHorizontal: 9,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardLight,
  },
  alarmToggleActive: {
    borderColor: "#6D4BC3",
    backgroundColor: "#211A35",
  },
  alarmToggleText: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  alarmToggleTextActive: {
    color: "#C4B5FD",
  },
  classArrow: {
    color: COLORS.muted,
    fontSize: 24,
    marginLeft: 8,
  },
  smallEmptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 32,
  },
  smallEmptyTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  smallEmptyText: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
  },
  quickActionsHeader: {
    marginBottom: 15,
  },
  quickActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#211A35",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  actionIconText: {
    color: "#C4B5FD",
    fontSize: 22,
    fontWeight: "600",
  },
  actionTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
  },
  actionDescription: {
    color: COLORS.muted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 5,
  },
  footer: {
    color: "#555A68",
    textAlign: "center",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: 32,
  },
});
