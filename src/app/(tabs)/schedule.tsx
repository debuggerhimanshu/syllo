import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import { supabase } from "@/lib/supabase";
import {
  configureNotifications,
  requestReminderPermission,
  syncClassReminders,
  DEFAULT_REMINDER_SETTINGS,
  type ReminderSettings,
} from "@/lib/notifications";

import {
  getReminderSettings,
  saveReminderSettings,
} from "@/lib/reminder-settings";

import { useAuth } from "@/context/AuthContext";

import {
  getLocalSchedule,
  saveRemoteSchedule,
  type LocalClass,
  type LocalCourse,
} from "@/lib/timetable-repository";
import { syncPendingNotes } from "@/lib/sync-engine";

import { syncClassAlarms } from "@/lib/class-alarms";
import { getClassAlarmSettings } from "@/lib/alarm-settings";

type Course = {
  id: string;
  name: string;
  code: string | null;
  faculty: string | null;
  color: string | null;
};

type Class = {
  id: string;
  course_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  room: string | null;
  slot: string | null;
  valid_from: string | null;
  valid_until: string | null;
};

type ScheduleItem = Class & {
  course: Course | null;
};

export default function ScheduleTab() {
const { user, loading: authLoading } = useAuth();
const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);
const [error, setError] = useState("");

const [reminderSettings, setReminderSettings] =
  useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
const [reminderLoading, setReminderLoading] = useState(true);
const [reminderSaving, setReminderSaving] = useState(false);
const [reminderStatus, setReminderStatus] = useState("");


  const loadReminderPreferences = async () => {
    try {
      const saved = await getReminderSettings();
      setReminderSettings(saved);
    } catch (err) {
      console.error("Failed to load reminder settings:", err);
    } finally {
      setReminderLoading(false);
    }
  };

  const syncReminders = async (
    items: ScheduleItem[],
    settings: ReminderSettings,
  ) => {
    try {
      await configureNotifications();

      const result = await syncClassReminders(
        items
          .filter(
            (item): item is ScheduleItem & { course: Course } =>
              item.course !== null,
          )
          
          .map((item) => ({
            id: item.id,
            weekday: item.weekday,
            start_time: item.start_time,
            valid_from: item.valid_from,
            valid_until: item.valid_until,
            course: {
              name: item.course.name,
              code: item.course.code,
            },
          })),

        settings,
      );

      if ("permissionDenied" in result && result.permissionDenied) {
        setReminderStatus("Allow notifications to receive class reminders.");
      } else {
        setReminderStatus(
          settings.enabled
            ? `${result.scheduled} class reminder(s) scheduled`
            : "Class reminders are turned off",
        );
      }
    } catch (err) {
      console.error("Failed to sync class reminders:", err);
      setReminderStatus("Couldn't update reminders. Please try again.");
    }
  };

  
const fetchSchedule = async (
  isRefresh = false,
  settingsToUse?: ReminderSettings,
  userId?: string,
) => {
  let localDataLoaded = false;

  try {
    if (!userId) {
      setSchedule([]);
      setLoading(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    // 1. Read SQLite first.
    const localData = await getLocalSchedule(userId);

    setSchedule(localData);
    localDataLoaded = true;
    setLoading(false);

    // Synchronize pending offline changes in the background.
    void syncPendingNotes().catch((err) => {
      console.error("Background synchronization failed:", err);
    });

    const activeSettings = settingsToUse ?? reminderSettings;

    // Keep reminders and alarms working with local data.
    await syncReminders(localData, activeSettings);

    const localAlarmSettings = await getClassAlarmSettings();

    await syncClassAlarms(
      localData.map((item) => ({
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
      })),
      localAlarmSettings,
    );

    // 2. Fetch the latest timetable from Supabase.
    const { data, error } = await supabase
      .from("classes")
      .select(`
        id,
        course_id,
        weekday,
        start_time,
        end_time,
        room,
        slot,
        valid_from,
        valid_until,
        courses (
          id,
          user_id,
          name,
          code,
          faculty,
          color
        )
      `)
      .eq("courses.user_id", userId)
      .order("weekday", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      throw error;
    }

    // 3. Normalize the Supabase response.
    const formattedData: ScheduleItem[] = (data ?? []).map(
      (item: any) => {
        const course = Array.isArray(item.courses)
          ? item.courses[0] ?? null
          : item.courses ?? null;

        return {
          id: item.id,
          course_id: item.course_id,
          weekday: item.weekday,
          start_time: item.start_time,
          end_time: item.end_time,
          room: item.room,
          slot: item.slot,
          valid_from: item.valid_from,
          valid_until: item.valid_until,
          course,
        };
      },
    );

    const remoteCourses: LocalCourse[] = formattedData
      .filter((item) => item.course !== null)
      .map((item) => item.course as LocalCourse)
      .filter(
        (course, index, array) =>
          array.findIndex((entry) => entry.id === course.id) === index,
      );

    const remoteClasses: LocalClass[] = formattedData.map(
      ({
        id,
        course_id,
        weekday,
        start_time,
        end_time,
        room,
        slot,
        valid_from,
        valid_until,
      }) => ({
        id,
        course_id,
        weekday,
        start_time,
        end_time,
        room,
        slot,
        valid_from,
        valid_until,
      }),
    );

    // 4. Update SQLite without overwriting pending offline changes.
    await saveRemoteSchedule(
      userId,
      remoteCourses,
      remoteClasses,
    );

    // 5. Read the updated local timetable.
    const updatedSchedule = await getLocalSchedule(userId);

    setSchedule(updatedSchedule);

    // 6. Synchronize reminders and alarms with the updated timetable.
    await syncReminders(updatedSchedule, activeSettings);

    const alarmSettings = await getClassAlarmSettings();

    const alarmResult = await syncClassAlarms(
      updatedSchedule.map((item) => ({
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
      })),
      alarmSettings,
    );

    console.log("Class alarms scheduled:", alarmResult.scheduled);
    console.log("Schedule loaded:", updatedSchedule);
  
} catch (err) {
  const errorMessage =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null
        ? JSON.stringify(err)
        : String(err);

  const isNetworkError =
    /fetch failed|UnknownHostException|Network request failed|Failed to fetch|Unable to resolve host/i.test(
      errorMessage
    );

  if (!isNetworkError) {
    console.error("Schedule loading error:", err);
  }

  // Keep displaying locally cached data when offline.
  if (!localDataLoaded) {
    setError("Couldn't load your schedule. Please try again.");
  }
} finally {
    setLoading(false);
    setRefreshing(false);
  }
};


  /*
   * Fetch every time the Schedule tab becomes active.
   */
  
  
useFocusEffect(
  useCallback(() => {
    let active = true;

    const initializeSchedule = async () => {
      if (authLoading) return;

      if (!user?.id) {
        setSchedule([]);
        setLoading(false);
        return;
      }

      setReminderLoading(true);

      try {
        const savedSettings = await getReminderSettings();

        if (!active) return;

        setReminderSettings(savedSettings);
        setReminderLoading(false);

        await fetchSchedule(false, savedSettings, user.id);
      } catch (err) {
        console.error("Failed to initialize schedule:", err);

        if (active) {
          setReminderLoading(false);
          setLoading(false);
        }
      }
    };

    void initializeSchedule();

    return () => {
      active = false;
    };
  }, [user?.id, authLoading])
);



  const handleRefresh = () => {
  if (user?.id) {
    void fetchSchedule(true, undefined, user.id);
  }
};

  const getDayName = (weekday: number) => {
    const days = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];

    return days[weekday - 1] ?? "Unknown";
  };


  const updateReminderSettings = async (
    nextSettings: ReminderSettings,
  ) => {
    if (reminderSaving) return;

    setReminderSaving(true);
    setReminderStatus("");

    try {
      if (nextSettings.enabled) {
        await configureNotifications();
        const permitted = await requestReminderPermission();

        if (!permitted) {
          setReminderStatus(
            "Notifications are blocked. Allow them in your phone settings.",
          );
          return;
        }
      }

      await saveReminderSettings(nextSettings);
      setReminderSettings(nextSettings);

      await syncReminders(schedule, nextSettings);
    } catch (err) {
      console.error("Failed to update reminder settings:", err);
      setReminderStatus("Couldn't save reminder settings. Please try again.");
    } finally {
      setReminderSaving(false);
    }
  };



useEffect(() => {
  if (authLoading || !user?.id) return;

  let isRefreshing = false;

  const subscription = AppState.addEventListener(
    "change",
    async (nextState) => {
      if (nextState !== "active" || isRefreshing) return;

      isRefreshing = true;

      try {
        const savedSettings = await getReminderSettings();

        setReminderSettings(savedSettings);

        await fetchSchedule(false, savedSettings, user.id);
      } catch (err) {
        console.error("Failed to refresh schedule:", err);
      } finally {
        isRefreshing = false;
      }
    },
  );

  return () => subscription.remove();
}, [user?.id, authLoading]);




  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color="#8B5CF6"
        />

        <Text style={styles.loadingText}>
          Loading your schedule...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>
          Couldn't load schedule
        </Text>

        <Text style={styles.errorText}>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#8B5CF6"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            Schedule
          </Text>

          <Text style={styles.subtitle}>
            Your weekly classes
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          activeOpacity={0.8}
          onPress={() => router.push("/add-class")}
        >
          <Text style={styles.addButtonText}>
            +
          </Text>
        </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.importButton}
          activeOpacity={0.8}
          onPress={() => router.push("/import-ffcs")}
        >
          <Text style={styles.importButtonText}>
            Import FFCS Timetable
          </Text>
        </TouchableOpacity> 

      
<View style={styles.reminderCard}>
  <View style={styles.reminderHeader}>
    <View style={{ flex: 1 }}>
      <Text style={styles.reminderTitle}>Class reminders</Text>
      <Text style={styles.reminderDescription}>
        Get notified before your classes
      </Text>
    </View>

    <TouchableOpacity
      activeOpacity={0.8}
      disabled={reminderSaving || reminderLoading}
      onPress={() =>
        void updateReminderSettings({
          ...reminderSettings,
          enabled: !reminderSettings.enabled,
        })
      }
      style={[
        styles.reminderToggle,
        reminderSettings.enabled && styles.reminderToggleActive,
      ]}
    >
      <Text style={styles.reminderToggleText}>
        {reminderSettings.enabled ? "ON" : "OFF"}
      </Text>
    </TouchableOpacity>
  </View>

  <Text style={styles.reminderLabel}>Remind me before class</Text>

  <View style={styles.reminderOptions}>
    {[5, 10, 15, 30].map((minutes) => (
      <TouchableOpacity
        key={minutes}
        activeOpacity={0.8}
        disabled={
          reminderSaving ||
          reminderLoading ||
          !reminderSettings.enabled
        }
        onPress={() =>
          void updateReminderSettings({
            ...reminderSettings,
            minutesBefore: minutes,
          })
        }
        style={[
          styles.reminderOption,
          reminderSettings.minutesBefore === minutes &&
            styles.reminderOptionActive,
          !reminderSettings.enabled && styles.reminderOptionDisabled,
        ]}
      >
        <Text
          style={[
            styles.reminderOptionText,
            reminderSettings.minutesBefore === minutes &&
              styles.reminderOptionTextActive,
          ]}
        >
          {minutes} min
        </Text>
      </TouchableOpacity>
    ))}
  </View>

  {!!reminderStatus && (
    <Text style={styles.reminderStatus}>{reminderStatus}</Text>
  )}

  {reminderSaving && (
    <Text style={styles.reminderStatus}>Updating reminders...</Text>
  )}
</View>
  
      
      {/* Schedule */}
      {schedule.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            No classes yet
          </Text>

          <Text style={styles.emptyText}>
            Add your courses and classes to see your
            timetable here.
          </Text>
        </View>
      ) : (
        schedule.map((item) => (
  <TouchableOpacity
    key={item.id}
    style={styles.classCard}
    activeOpacity={0.8}
    onPress={() =>
      router.push({
        pathname: "/class-details",
        params: {
          id: item.id,
        },
      })
    }
  >
    <View style={styles.daySection}>
      <Text style={styles.day}>
        {getDayName(item.weekday)}
      </Text>

      <Text style={styles.time}>
        {item.start_time.slice(0, 5)} –{" "}
        {item.end_time.slice(0, 5)}
      </Text>
    </View>

    <View style={styles.classInfo}>
      <Text style={styles.courseName}>
        {item.course?.name ?? "Unknown course"}
      </Text>

      {item.course?.code && (
        <Text style={styles.courseCode}>
          {item.course.code}
        </Text>
      )}

      {item.room && (
        <Text style={styles.room}>
          Room {item.room}
        </Text>
      )}
    </View>
  </TouchableOpacity>
))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08090D",
  },

  content: {
    padding: 28,
    paddingTop: 70,
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    backgroundColor: "#08090D",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },

  title: {
    color: "#F5F7FA",
    fontSize: 32,
    fontWeight: "800",
  },

  subtitle: {
    color: "#777D8A",
    marginTop: 10,
    fontSize: 15,
  },

  addButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#8B5CF6",
    alignItems: "center",
    justifyContent: "center",
  },

  addButtonText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "400",
    lineHeight: 30,
  },

  importButton: {
  height: 50,
  borderRadius: 14,
  backgroundColor: "#111318",
  borderWidth: 1,
  borderColor: "#8B5CF6",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 22,
},

importButtonText: {
  color: "#A78BFA",
  fontSize: 14,
  fontWeight: "700",
},

  loadingText: {
    color: "#8F95A3",
    marginTop: 14,
    fontSize: 14,
  },

  errorTitle: {
    color: "#F5F7FA",
    fontSize: 20,
    fontWeight: "700",
  },

  errorText: {
    color: "#FF6B6B",
    marginTop: 10,
    textAlign: "center",
  },

  emptyCard: {
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#20232B",
    borderRadius: 18,
    padding: 24,
    marginTop: 10,
  },

  emptyTitle: {
    color: "#F5F7FA",
    fontSize: 18,
    fontWeight: "700",
  },

  emptyText: {
    color: "#777D8A",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },

  classCard: {
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#20232B",
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },

  daySection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  day: {
    color: "#8B5CF6",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  time: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "600",
  },

  classInfo: {
    marginTop: 14,
  },

  courseName: {
    color: "#F5F7FA",
    fontSize: 18,
    fontWeight: "700",
  },

  courseCode: {
    color: "#8F95A3",
    fontSize: 13,
    marginTop: 5,
  },

  room: {
    color: "#777D8A",
    fontSize: 13,
    marginTop: 8,
  },

  
reminderCard: {
  backgroundColor: "#111318",
  borderWidth: 1,
  borderColor: "#29233D",
  borderRadius: 18,
  padding: 18,
  marginBottom: 22,
},
reminderHeader: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
},
reminderTitle: {
  color: "#F5F7FA",
  fontSize: 16,
  fontWeight: "700",
},
reminderDescription: {
  color: "#777D8A",
  fontSize: 12,
  marginTop: 5,
},
reminderToggle: {
  paddingHorizontal: 15,
  paddingVertical: 9,
  borderRadius: 10,
  backgroundColor: "#252832",
},
reminderToggleActive: {
  backgroundColor: "#6D42D8",
},
reminderToggleText: {
  color: "#FFFFFF",
  fontSize: 12,
  fontWeight: "800",
},
reminderLabel: {
  color: "#9CA3AF",
  fontSize: 12,
  marginTop: 22,
  marginBottom: 12,
},
reminderOptions: {
  flexDirection: "row",
  gap: 8,
},
reminderOption: {
  flex: 1,
  alignItems: "center",
  paddingVertical: 11,
  borderRadius: 10,
  backgroundColor: "#1A1C24",
  borderWidth: 1,
  borderColor: "#292D38",
},
reminderOptionActive: {
  backgroundColor: "#29203F",
  borderColor: "#8B5CF6",
},
reminderOptionDisabled: {
  opacity: 0.45,
},
reminderOptionText: {
  color: "#A1A6B3",
  fontSize: 12,
  fontWeight: "600",
},
reminderOptionTextActive: {
  color: "#C4B5FD",
},
reminderStatus: {
  color: "#A78BFA",
  fontSize: 12,
  marginTop: 14,
  lineHeight: 18,
},


});