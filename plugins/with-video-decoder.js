const fs = require('fs');
const path = require('path');
const {
  withDangerousMod,
  withMainApplication,
  withAppBuildGradle,
} = require('expo/config-plugins');

const NATIVE_MODULE_FILES = ['VideoDecoderModule.kt'];

function copyVideoDecoderModule(config) {
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

function registerVideoDecoderPackage(config) {
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

    cfg.modResults.contents = contents;
    return cfg;
  });
}

function addVideoDecoderDependencies(config) {
  return withAppBuildGradle(config, cfg => {
    let contents = cfg.modResults.contents;

    // react-native-video exposes media3 only as `implementation`, so app-module
    // Kotlin code cannot resolve ReactExoplayerView's media3 supertypes.
    if (!contents.includes('androidx.media3:media3-exoplayer')) {
      contents = contents.replace(
        /dependencies\s*\{/,
        match =>
          `${match}\n    implementation "androidx.media3:media3-exoplayer:1.8.0"\n    implementation "androidx.media3:media3-common:1.8.0"\n`,
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = function withVideoDecoder(config) {
  config = copyVideoDecoderModule(config);
  config = registerVideoDecoderPackage(config);
  config = addVideoDecoderDependencies(config);
  return config;
};
