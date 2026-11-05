import React, { useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import YtPlayer, { YtPlayerHandle } from "./YtPlayer";
import { useYtPlayerStore } from "../playerStore";
import { YT } from "../theme";

export const MINI_W = 180;

/** Floating bottom-right player shown after minimizing the video page. */
export default function YtMiniPlayer({ bottom }: { bottom: number }) {
  const navigation = useNavigation<any>();
  const mini = useYtPlayerStore((s) => s.mini);
  const clearMini = useYtPlayerStore((s) => s.clearMini);
  const [paused, setPaused] = useState(false);
  const ref = useRef<YtPlayerHandle>(null);
  if (!mini) return null;

  const expand = () => {
    const position = ref.current?.position() ?? mini.position;
    navigation.navigate("YtVideo", { video: mini.video, startAt: position });
  };

  return (
    <View style={[styles.box, { bottom }]}>
      <TouchableOpacity activeOpacity={0.9} onPress={expand} style={styles.video} accessibilityLabel="Open video">
        <YtPlayer
          ref={ref}
          link={mini.video.link}
          startAt={mini.position}
          paused={paused}
          style={StyleSheet.absoluteFill}
        />
      </TouchableOpacity>
      <View style={styles.bar}>
        <Text style={styles.title} numberOfLines={1}>
          {mini.video.title}
        </Text>
        <TouchableOpacity hitSlop={8} onPress={() => setPaused((v) => !v)} accessibilityLabel={paused ? "Play" : "Pause"}>
          <Ionicons name={paused ? "play" : "pause"} size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity hitSlop={8} onPress={clearMini} accessibilityLabel="Close mini player">
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: "absolute",
    right: 12,
    width: MINI_W,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: YT.surface,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  video: { width: MINI_W, height: Math.round((MINI_W * 9) / 16), backgroundColor: "#000" },
  bar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, height: 34 },
  title: { flex: 1, color: "#fff", fontSize: 12 },
});
