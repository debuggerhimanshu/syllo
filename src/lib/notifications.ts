
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export type ClassReminder = {
  id: string;
  weekday: number; // Monday = 1 ... Sunday = 7
  start_time: string;
  valid_from?: string | null;
  valid_until?: string | null;
  course: {
    name: string;
    code?: string | null;
  };
};

export type ReminderSettings = {
  enabled: boolean;
  minutesBefore: number;
};

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,
  minutesBefore: 10,
};

const REMINDER_PREFIX = "syllo-class-reminder:";
const DATE_WINDOW_DAYS = 14;
const MAX_PENDING_CLASS_REMINDERS = 50;

export async function configureNotifications() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("class-reminders-v2", {
      name: "Class reminders",
      description: "Notifications before your scheduled classes",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return Notifications.getPermissionsAsync();
}

export async function requestReminderPermission() {
  const current = await Notifications.getPermissionsAsync();

  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function getClassDate(
  weekday: number,
  startTime: string,
  offsetWeeks: number,
): Date | null {
  const match = /^(\d{2}):(\d{2})/.exec(startTime);

  if (!match || weekday < 1 || weekday > 7) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return null;

  const date = new Date();
  date.setHours(0, 0, 0, 0);

  // Convert JavaScript Sunday=0 to database Monday=1 ... Sunday=7.
  const todayWeekday = date.getDay() === 0 ? 7 : date.getDay();
  const daysUntil = (weekday - todayWeekday + 7) % 7;

  date.setDate(date.getDate() + daysUntil + offsetWeeks * 7);
  date.setHours(hours, minutes, 0, 0);

  return date;
}

function getReminderDate(classDate: Date, minutesBefore: number) {
  return new Date(classDate.getTime() - minutesBefore * 60_000);
}

function isWithinValidity(
  classDate: Date,
  validFrom: Date | null,
  validUntil: Date | null,
) {
  const day = new Date(classDate);
  day.setHours(0, 0, 0, 0);

  if (validFrom && day < validFrom) return false;
  if (validUntil && day > validUntil) return false;

  return true;
}

function makeNotificationContent(
  item: ClassReminder,
  minutesBefore: number,
) {
  return {
    title: item.course.code
      ? `${item.course.code} starts soon`
      : "Class starts soon",
    body: item.course.name
      ? `${item.course.name} starts in ${minutesBefore} minutes.`
      : `Your class starts in ${minutesBefore} minutes.`,
    data: {
      type: "class-reminder",
      classId: item.id,
    },
  };
}

export async function syncClassReminders(
  classes: ClassReminder[],
  settings: ReminderSettings,
) {
  const scheduled =
    await Notifications.getAllScheduledNotificationsAsync();

  const existing = scheduled.filter((item) =>
    item.identifier.startsWith(REMINDER_PREFIX),
  );

  await Promise.all(
    existing.map((item) =>
      Notifications.cancelScheduledNotificationAsync(item.identifier),
    ),
  );

  if (!settings.enabled) return { scheduled: 0 };

  const permission = await Notifications.getPermissionsAsync();

  if (!permission.granted) {
    return { scheduled: 0, permissionDenied: true };
  }

  let scheduledCount = 0;
  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + DATE_WINDOW_DAYS);

  for (const item of classes) {
    if (scheduledCount >= MAX_PENDING_CLASS_REMINDERS) break;

    const validFrom = parseDate(item.valid_from);
    const validUntil = parseDate(item.valid_until);

    if (item.valid_from && !validFrom) continue;
    if (item.valid_until && !validUntil) continue;
    if (validFrom && validUntil && validFrom > validUntil) continue;

    const isDateRestricted = Boolean(item.valid_from || item.valid_until);
    const content = makeNotificationContent(
      item,
      settings.minutesBefore,
    );

    // Unrestricted classes can safely use a repeating weekly trigger.
    if (!isDateRestricted) {
      const match = /^(\d{2}):(\d{2})/.exec(item.start_time);
      if (!match || item.weekday < 1 || item.weekday > 7) continue;

      const hours = Number(match[1]);
      const minutes = Number(match[2]);

      if (hours > 23 || minutes > 59) continue;

      // Calculate the reminder's own weekday and time. This correctly
      // handles reminders that fall on the previous calendar day.
      const reminderMinutes =
        hours * 60 + minutes - settings.minutesBefore;
      const dayOffset = Math.floor(reminderMinutes / 1440);
      const normalizedMinutes =
        ((reminderMinutes % 1440) + 1440) % 1440;

      const reminderWeekday =
        ((item.weekday - 1 + dayOffset + 7) % 7) + 1;
      
      await Notifications.scheduleNotificationAsync({
        identifier: `${REMINDER_PREFIX}${item.id}`,
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: reminderWeekday === 7 ? 1 : reminderWeekday + 1,
          hour: Math.floor(normalizedMinutes / 60),
          minute: normalizedMinutes % 60,
          channelId:
            Platform.OS === "android" ? "class-reminders-v2" : undefined,
        },
      });

      scheduledCount++;
      continue;
    }

    // Date-restricted classes use one-time reminders so they cannot
    // repeat indefinitely beyond their valid dates.
    for (
  let offset = 0;
  offset <= Math.ceil(DATE_WINDOW_DAYS / 7);
  offset++
) {
      if (scheduledCount >= MAX_PENDING_CLASS_REMINDERS) break;

      const classDate = getClassDate(
        item.weekday,
        item.start_time,
        offset,
      );

      if (!classDate || classDate <= now || classDate > windowEnd) {
        continue;
      }

      if (!isWithinValidity(classDate, validFrom, validUntil)) {
        continue;
      }

      const reminderDate = getReminderDate(
        classDate,
        settings.minutesBefore,
      );

      if (reminderDate <= now) continue;

      const dateKey = [
        classDate.getFullYear(),
        String(classDate.getMonth() + 1).padStart(2, "0"),
        String(classDate.getDate()).padStart(2, "0"),
      ].join("-");

      await Notifications.scheduleNotificationAsync({
        identifier: `${REMINDER_PREFIX}${item.id}:${dateKey}`,
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderDate,
          channelId:
            Platform.OS === "android" ? "class-reminders-v2" : undefined,
        },
      });

      scheduledCount++;
    }
  }

  return { scheduled: scheduledCount };
}
