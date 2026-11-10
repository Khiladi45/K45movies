// Makes the single Android APK installable and launchable on Android TV while
// leaving phones unchanged:
//   - LEANBACK_LAUNCHER next to the phone LAUNCHER, so the app shows up on the
//     TV home screen
//   - a 320x180 TV banner (assets/tv-banner.png)
//   - touchscreen / faketouch declared optional (TVs have neither)
//   - 32-bit + 64-bit ARM builds, so it installs on 32-bit TV boxes too
// Android only on purpose: the react-native-tvos Expo plugin would also turn
// the iOS project into a tvOS app.
const fs = require("fs");
const path = require("path");
const {
  withAndroidManifest,
  withDangerousMod,
  withGradleProperties,
  AndroidConfig,
} = require("expo/config-plugins");

const BANNER_SOURCE = "assets/tv-banner.png";
const ABIS = "armeabi-v7a,arm64-v8a";

function withBannerFile(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const root = cfg.modRequest.projectRoot;
      const dir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "drawable-xhdpi",
      );
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(
        path.join(root, BANNER_SOURCE),
        path.join(dir, "tv_banner.png"),
      );
      return cfg;
    },
  ]);
}

function withTvManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    const features = (manifest["uses-feature"] = manifest["uses-feature"] || []);
    for (const name of [
      "android.hardware.touchscreen",
      "android.hardware.faketouch",
    ]) {
      if (!features.some((f) => f.$["android:name"] === name)) {
        features.push({ $: { "android:name": name, "android:required": "false" } });
      }
    }
    if (!features.some((f) => f.$["android:name"] === "android.software.leanback")) {
      features.push({
        $: { "android:name": "android.software.leanback", "android:required": "false" },
      });
    }

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.$["android:banner"] = "@drawable/tv_banner";

    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    const launcher = (activity["intent-filter"] || []).find((filter) =>
      (filter.category || []).some(
        (c) => c.$["android:name"] === "android.intent.category.LAUNCHER",
      ),
    );
    if (
      launcher &&
      !launcher.category.some(
        (c) => c.$["android:name"] === "android.intent.category.LEANBACK_LAUNCHER",
      )
    ) {
      launcher.category.push({
        $: { "android:name": "android.intent.category.LEANBACK_LAUNCHER" },
      });
    }
    return cfg;
  });
}

function withBothArmAbis(config) {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const existing = props.find(
      (p) => p.type === "property" && p.key === "reactNativeArchitectures",
    );
    if (existing) existing.value = ABIS;
    else props.push({ type: "property", key: "reactNativeArchitectures", value: ABIS });
    return cfg;
  });
}

module.exports = function withAndroidTv(config) {
  return withBothArmAbis(withTvManifest(withBannerFile(config)));
};
