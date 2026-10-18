import { registerWebModule, NativeModule } from 'expo';

// SylloAlarmModule is not available on the web platform.
class SylloAlarmModule extends NativeModule<{}> {}

export default registerWebModule(SylloAlarmModule, 'SylloAlarmModule');
