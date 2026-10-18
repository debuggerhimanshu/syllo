
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { ClassAlarmSettings } from "@/lib/alarm-settings";

export type AlarmClass = {
  id: string;
  weekday: number; // Monday = 1 ... Sunday = 7
  start_time: string;
  valid_from?: string | null;
  valid_until?: string | null;
  course: {
    name: string;
    code?: string | null;
  } | null;
};

const ALARM_PREFIX = "syllo-class-alarm:";
const ALARM_CHANNEL_ID = "syllo-class-alarms-v1";
const MINUTES_BEFORE_CLASS = 5;
const WINDOW_DAYS = 14;
const MAX_PENDING_ALARMS = 50;

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

  const todayWeekday = date.getDay() === 0 ? 7 : date.getDay();
  const daysUntil = (weekday - todayWeekday + 7) % 7;

  date.setDate(date.getDate() + daysUntil + offsetWeeks * 7);
  date.setHours(hours, minutes, 0, 0);

  return date;
}

function isWithinValidity(
  classDate: Date,
  validFrom: Date | null,
  validUntil: Date | null,
): boolean {
  const day = new Date(classDate);
  day.setHours(0, 0, 0, 0);

  if (validFrom && day < validFrom) return false;
  if (validUntil && day > validUntil) return false;

  return true;
}

function makeAlarmContent(item: AlarmClass) {
  return {
    title: item.course?.code
      ? `Class alarm · ${item.course.code}`
      : "Class alarm",
    body: `${item.course?.name ?? "Your class"} starts in 5 minutes. Get ready!`,
    sound: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
    vibrate: [0, 500, 250, 500, 250, 500],
    data: {
      type: "class-alarm",
      classId: item.id,
    },
  };
}

export async function syncClassAlarms(
  classes: AlarmClass[],
  settings: ClassAlarmSettings,
): Promise<{ scheduled: number; permissionDenied?: boolean }> {
  if (Platform.OS === "android") {
    const { default: SylloAlarm } = await import(
      "../../modules/syllo-alarm/src/SylloAlarmModule"
    );

    const enabledClasses = classes.filter(
      (item) => settings[item.id] === true && item.course,
    );

    if (enabledClasses.length === 0) {
      SylloAlarm.cancelAllAlarms();

      const pending = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.all(
        pending
          .filter((item) => item.identifier.startsWith(ALARM_PREFIX))
          .map((item) =>
            Notifications.cancelScheduledNotificationAsync(item.identifier),
          ),
      );

      return { scheduled: 0 };
    }

    const permission = await Notifications.getPermissionsAsync();

    if (!permission.granted) {
      return { scheduled: 0, permissionDenied: true };
    }

    if (!SylloAlarm.canScheduleExactAlarms()) {
      SylloAlarm.openAlarmPermissionSettings();
      return { scheduled: 0, permissionDenied: true };
    }

    if (!SylloAlarm.canUseFullScreenIntent()) {
      SylloAlarm.openFullScreenPermissionSettings();
      return { scheduled: 0, permissionDenied: true };
    }

    const pending = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      pending
        .filter((item) => item.identifier.startsWith(ALARM_PREFIX))
        .map((item) =>
          Notifications.cancelScheduledNotificationAsync(item.identifier),
        ),
    );

    SylloAlarm.cancelAllAlarms();

    const now = new Date();
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + WINDOW_DAYS);

    let scheduled = 0;

    for (const item of enabledClasses) {
      if (scheduled >= MAX_PENDING_ALARMS) break;

      const validFrom = parseDate(item.valid_from);
      const validUntil = parseDate(item.valid_until);

      if (item.valid_from && !validFrom) continue;
      if (item.valid_until && !validUntil) continue;
      if (validFrom && validUntil && validFrom > validUntil) continue;

      for (
        let offset = 0;
        offset <= Math.ceil(WINDOW_DAYS / 7);
        offset++
      ) {
        if (scheduled >= MAX_PENDING_ALARMS) break;

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

        const alarmDate = new Date(
          classDate.getTime() - MINUTES_BEFORE_CLASS * 60_000,
        );

        if (alarmDate <= now) continue;

        const dateKey = [
          classDate.getFullYear(),
          String(classDate.getMonth() + 1).padStart(2, "0"),
          String(classDate.getDate()).padStart(2, "0"),
        ].join("-");

        const alarmId = `${item.id}:${dateKey}`;
        const course = item.course;
        if (!course) continue;

        const className = course.code
          ? `${course.code} · ${course.name}`
          : course.name;

        SylloAlarm.scheduleAlarm(
          alarmId,
          className,
          alarmDate.getTime(),
        );

        scheduled++;
      }
    }

    return { scheduled };
  }

  // Existing Expo notification behavior for iOS and other platforms.
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const existing = pending.filter((item) =>
    item.identifier.startsWith(ALARM_PREFIX),
  );

  await Promise.all(
    existing.map((item) =>
      Notifications.cancelScheduledNotificationAsync(item.identifier),
    ),
  );

  if (!classes.some((item) => settings[item.id] === true)) {
    return { scheduled: 0 };
  }

  const permission = await Notifications.getPermissionsAsync();

  if (!permission.granted) {
    return { scheduled: 0, permissionDenied: true };
  }

  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + WINDOW_DAYS);

  let scheduled = 0;

  for (const item of classes) {
    if (scheduled >= MAX_PENDING_ALARMS) break;
    if (settings[item.id] !== true || !item.course) continue;

    const validFrom = parseDate(item.valid_from);
    const validUntil = parseDate(item.valid_until);

    if (item.valid_from && !validFrom) continue;
    if (item.valid_until && !validUntil) continue;
    if (validFrom && validUntil && validFrom > validUntil) continue;

    const content = makeAlarmContent(item);
    const dateRestricted = Boolean(item.valid_from || item.valid_until);

    if (!dateRestricted) {
      const match = /^(\d{2}):(\d{2})/.exec(item.start_time);
      if (!match || item.weekday < 1 || item.weekday > 7) continue;

      const hours = Number(match[1]);
      const minutes = Number(match[2]);

      if (hours > 23 || minutes > 59) continue;

      const alarmMinutes = hours * 60 + minutes - MINUTES_BEFORE_CLASS;
      const dayOffset = Math.floor(alarmMinutes / 1440);
      const normalized = ((alarmMinutes % 1440) + 1440) % 1440;
      const alarmWeekday = ((item.weekday - 1 + dayOffset + 7) % 7) + 1;

      await Notifications.scheduleNotificationAsync({
        identifier: `${ALARM_PREFIX}${item.id}`,
        content: {
          ...content,
          data: { ...content.data, channelId: ALARM_CHANNEL_ID },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: alarmWeekday === 7 ? 1 : alarmWeekday + 1,
          hour: Math.floor(normalized / 60),
          minute: normalized % 60,
          channelId: undefined,
        },
      });

      scheduled++;
      continue;
    }

    for (let offset = 0; offset <= Math.ceil(WINDOW_DAYS / 7); offset++) {
      if (scheduled >= MAX_PENDING_ALARMS) break;

      const classDate = getClassDate(item.weekday, item.start_time, offset);

      if (!classDate || classDate <= now || classDate > windowEnd) continue;
      if (!isWithinValidity(classDate, validFrom, validUntil)) continue;

      const alarmDate = new Date(
        classDate.getTime() - MINUTES_BEFORE_CLASS * 60_000,
      );

      if (alarmDate <= now) continue;

      const dateKey = [
        classDate.getFullYear(),
        String(classDate.getMonth() + 1).padStart(2, "0"),
        String(classDate.getDate()).padStart(2, "0"),
      ].join("-");

      await Notifications.scheduleNotificationAsync({
        identifier: `${ALARM_PREFIX}${item.id}:${dateKey}`,
        content: {
          ...content,
          data: { ...content.data, channelId: ALARM_CHANNEL_ID },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: alarmDate,
          channelId: undefined,
        },
      });

      scheduled++;
    }
  }

  return { scheduled };
}
