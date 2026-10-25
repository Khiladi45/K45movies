const fs = require('fs');
const path = require('path');
const {
  withDangerousMod,
  withMainApplication,
  withAppBuildGradle,
  withProjectBuildGradle,
  withAndroidManifest,
} = require('expo/config-plugins');

const NATIVE_MODULE_FILES = ['VideoDecoderModule.kt', 'K45DohOkHttpFactory.kt'];
const MEDIA3_VERSION = '1.8.0';
const MEDIA3_MARKER = '// K45: align Media3 with react-native-video and its FFmpeg decoder.';

function copyNativeFiles(config) {
  return withDangerousMod(config, [
    'android',
    async cfg => {
      const projectRoot = cfg.modRequest.projectRoot;
      const targetDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'vega',
      );
      const sourceDir = path.join(
        projectRoot,
        'native-src',
        'android',
        'com',
        'vega',
      );

      fs.mkdirSync(targetDir, {recursive: true});

      for (const file of NATIVE_MODULE_FILES) {
        const sourceFile = path.join(sourceDir, file);
        if (!fs.existsSync(sourceFile)) continue;
        fs.copyFileSync(sourceFile, path.join(targetDir, file));
      }

      return cfg;
    },
  ]);
}

function registerNativeCode(config) {
  return withMainApplication(config, cfg => {
    let contents = cfg.modResults.contents;

    if (!contents.includes('add(VideoDecoderPackage())')) {
      contents = contents.replace(
        /PackageList\(this\)\.packages\.apply \{\n/,
        match => `${match}              add(VideoDecoderPackage())\n`,
      );
    }

    if (!contents.includes('import com.vega.VideoDecoderPackage')) {
      contents = contents.replace(
        /^(package .+\n)/m,
        match => `${match}\nimport com.vega.VideoDecoderPackage\n`,
      );
    }

    // DNS-over-HTTPS for every RN / Fresco / ExoPlayer request. Must be set
    // before React Native builds its first OkHttp client, so hook right after
    // super.onCreate().
    if (!contents.includes('setOkHttpClientFactory')) {
      if (
        !contents.includes(
          'import com.facebook.react.modules.network.OkHttpClientProvider',
        )
      ) {
        contents = contents.replace(
          /^(package .+\n)/m,
          match =>
            `${match}\nimport com.facebook.react.modules.network.OkHttpClientProvider\nimport com.vega.K45DohOkHttpFactory\n`,
        );
      }
      contents = contents.replace(
        /super\.onCreate\(\)\n/,
        match =>
          `${match}    OkHttpClientProvider.setOkHttpClientFactory(K45DohOkHttpFactory(cacheDir))\n`,
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

function addGradleDependencies(config) {
  return withAppBuildGradle(config, cfg => {
    let contents = cfg.modResults.contents;

    // react-native-video exposes media3 only as `implementation`, so app-module
    // Kotlin code cannot resolve ReactExoplayerView's media3 supertypes.
    if (!contents.includes('androidx.media3:media3-exoplayer')) {
      contents = contents.replace(
        /dependencies\s*\{/,
        match =>
          `${match}\n    implementation "androidx.media3:media3-exoplayer:${MEDIA3_VERSION}"\n    implementation "androidx.media3:media3-common:${MEDIA3_VERSION}"\n`,
      );
    }

    if (!contents.includes('com.squareup.okhttp3:okhttp-dnsoverhttps')) {
      contents = contents.replace(
        /dependencies\s*\{/,
        match =>
          `${match}\n    implementation 'com.squareup.okhttp3:okhttp-dnsoverhttps:4.12.0'\n    implementation 'com.squareup.okhttp3:okhttp:4.12.0'\n`,
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

// Every androidx.media3 artifact (react-native-video, the Jellyfin FFmpeg
// decoder, our module) must resolve to the same version, otherwise the player
// can load mismatched codec-selection classes at runtime.
function alignMedia3(config) {
  return withProjectBuildGradle(config, cfg => {
    if (!cfg.modResults.contents.includes(MEDIA3_MARKER)) {
      cfg.modResults.contents += `
${MEDIA3_MARKER}
allprojects {
    configurations.configureEach {
        resolutionStrategy.eachDependency { details ->
            if (details.requested.group == 'androidx.media3') {
                details.useVersion '${MEDIA3_VERSION}'
                details.because 'react-native-video and the FFmpeg decoder require the Media3 1.8 API'
            }
        }
    }
}
`;
    }
    return cfg;
  });
}

// 4K decoding + buffers need more Java heap than the default 256MB class.
function enableLargeHeap(config) {
  return withAndroidManifest(config, cfg => {
    const application = cfg.modResults.manifest.application?.[0];
    if (application?.$) application.$['android:largeHeap'] = 'true';
    return cfg;
  });
}

module.exports = function withVideoDecoder(config) {
  config = copyNativeFiles(config);
  config = registerNativeCode(config);
  config = addGradleDependencies(config);
  config = alignMedia3(config);
  config = enableLargeHeap(config);
  return config;
};
