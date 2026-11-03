// Permissions needed for background playback.
//
// - Android 13+: POST_NOTIFICATIONS, so the media notification (play / pause
//   while the app is in the background) can be shown.
// - Picture-in-Picture and the foreground media service need no runtime
//   permission. "Draw over other apps" is NOT required: PiP is the system's own
//   floating window.
// Asked once; the system remembers the answer.

import { PermissionsAndroid, Platform } from "react-native";
import { createMMKV } from "react-native-mmkv";

const mmkv = createMMKV();
const ASKED_KEY = "k45-bg-permission-asked";

export async function ensureBackgroundPermissions(): Promise<void> {
  if (Platform.OS !== "android" || Number(Platform.Version) < 33) return;
  try {
    if (mmkv.getBoolean(ASKED_KEY)) return;
    mmkv.set(ASKED_KEY, true);
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      {
        title: "Background playback",
        message:
          "Allow notifications so you can pause or resume the video from the notification while the app is in the background.",
        buttonPositive: "Allow",
        buttonNegative: "Not now",
      },
    );
  } catch {
    // best effort
  }
}
