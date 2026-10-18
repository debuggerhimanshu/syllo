
import { NativeModule, requireNativeModule } from "expo";

declare class SylloAlarmModule extends NativeModule<{}> {
  canScheduleExactAlarms(): boolean;
  canUseFullScreenIntent(): boolean;
  openAlarmPermissionSettings(): boolean;
  openFullScreenPermissionSettings(): boolean;

  scheduleAlarm(
    alarmId: string,
    className: string,
    triggerAtMillis: number
  ): boolean;

  cancelAlarm(alarmId: string): boolean;
  cancelAllAlarms(): boolean;
}

export default requireNativeModule<SylloAlarmModule>("SylloAlarm");
