import React from "react";
import { View, Text } from "react-native";
import { usePlayerStore } from "@/store/usePlayerStore";
import VideoPlayer from "@/components/videoPlayer";
import { useThemeStore } from "@/store/useThemeStore";

export default function PlayerScreen({ navigation }: any) {
  const currentVideoUrl = usePlayerStore((s) => s.currentVideoUrl);
  const streams = usePlayerStore((s) => s.streams);
  const initialStreamIndex = usePlayerStore((s) => s.initialStreamIndex);
  const playerMeta = usePlayerStore((s) => s.playerMeta);
  const closeMiniPlayer = usePlayerStore((s) => s.closeMiniPlayer);
  const { primaryColor } = useThemeStore();

  if (!currentVideoUrl) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 16 }}>No video selected</Text>
      </View>
    );
  }

  return (
    <VideoPlayer
      videoUrl={currentVideoUrl}
      streams={streams}
      initialStreamIndex={initialStreamIndex}
      title={playerMeta?.title}
      episodeTitle={playerMeta?.episode}
      meta={playerMeta}
      accentColor={primaryColor}
      onBack={() => {
        closeMiniPlayer();
        navigation.goBack();
      }}
    />
  );
}
