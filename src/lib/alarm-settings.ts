import * as SecureStore from "expo-secure-store";

const ALARM_SETTINGS_KEY = "syllo-class-alarm-settings";

export type ClassAlarmSettings = Record<string, boolean>;

export async function getClassAlarmSettings(): Promise<ClassAlarmSettings> {
  try {
    const stored = await SecureStore.getItemAsync(ALARM_SETTINGS_KEY);

    if (!stored) return {};

    const parsed: unknown = JSON.parse(stored);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }

    const settings: ClassAlarmSettings = {};

    for (const [classId, enabled] of Object.entries(parsed)) {
      if (typeof enabled === "boolean") {
        settings[classId] = enabled;
      }
    }

    return settings;
  } catch (error) {
    console.error("Failed to read class alarm settings:", error);
    return {};
  }
}

export async function saveClassAlarmSettings(
  settings: ClassAlarmSettings,
): Promise<void> {
  await SecureStore.setItemAsync(
    ALARM_SETTINGS_KEY,
    JSON.stringify(settings),
  );
}
