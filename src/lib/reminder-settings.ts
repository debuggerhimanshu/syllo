
import * as SecureStore from "expo-secure-store";
import {
  DEFAULT_REMINDER_SETTINGS,
  type ReminderSettings,
} from "@/lib/notifications";

const SETTINGS_KEY = "syllo-class-reminder-settings";

export async function getReminderSettings(): Promise<ReminderSettings> {
  try {
    const stored = await SecureStore.getItemAsync(SETTINGS_KEY);

    if (!stored) {
      return DEFAULT_REMINDER_SETTINGS;
    }

    const parsed: unknown = JSON.parse(stored);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "enabled" in parsed &&
      "minutesBefore" in parsed &&
      typeof parsed.enabled === "boolean" &&
      typeof parsed.minutesBefore === "number" &&
      [5, 10, 15, 30].includes(parsed.minutesBefore)
    ) {
      return {
        enabled: parsed.enabled,
        minutesBefore: parsed.minutesBefore,
      };
    }

    return DEFAULT_REMINDER_SETTINGS;
  } catch (error) {
    console.error("Failed to read reminder settings:", error);
    return DEFAULT_REMINDER_SETTINGS;
  }
}

export async function saveReminderSettings(
  settings: ReminderSettings,
): Promise<void> {
  await SecureStore.setItemAsync(
    SETTINGS_KEY,
    JSON.stringify(settings),
  );
}
