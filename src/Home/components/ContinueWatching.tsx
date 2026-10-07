import React, { memo } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useContinueWatchingStore } from "@/store/useContinueWatchingStore";
import { useThemeStore } from "@/store/useThemeStore";

const CARD_WIDTH = 152;
const CARD_HEIGHT = 96;

const ContinueWatching = memo(function ContinueWatching({ navigation }: any) {
  const items = useContinueWatchingStore((s) => s.items);
  const remove = useContinueWatchingStore((s) => s.remove);
  const { primaryColor } = useThemeStore();

  if (!items.length) return null;

  return (
    <View style={{ marginBottom: 24 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginLeft: 16,
          marginRight: 16,
          marginBottom: 14,
        }}
      >
        <View
          style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: primaryColor }}
        />
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", flex: 1 }}>
          Continue Watching
        </Text>
      </View>
      <FlatList
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        keyExtractor={(item) => item.link}
        renderItem={({ item }) => {
          const progress =
            item.duration > 0
              ? Math.min(1, Math.max(0.04, item.position / item.duration))
              : 0.04;
          return (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() =>
                navigation.navigate("Detail", {
                  movie: {
                    link: item.link,
                    title: item.title,
                    image: item.image,
                    type: item.type,
                  },
                  providerId: item.providerId,
                })
              }
              onLongPress={() => remove(item.link)}
              style={{ width: CARD_WIDTH }}
            >
              <View
                style={{
                  width: CARD_WIDTH,
                  height: CARD_HEIGHT,
                  borderRadius: 10,
                  overflow: "hidden",
                  backgroundColor: "#111",
                }}
              >
                <Image
                  source={{ uri: item.image }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  transition={200}
                />
                <View
                  style={{
                    ...StyleSheet.absoluteFill,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(0,0,0,0.25)",
                  }}
                >
                  <Ionicons name="play-circle" size={34} color="rgba(255,255,255,0.95)" />
                </View>
                {/* Progress bar */}
                <View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    backgroundColor: "rgba(255,255,255,0.25)",
                  }}
                >
                  <View
                    style={{
                      width: `${progress * 100}%`,
                      height: "100%",
                      backgroundColor: primaryColor,
                    }}
                  />
                </View>
              </View>
              <Text
                numberOfLines={1}
                style={{ color: "#ddd", fontSize: 12, marginTop: 6, fontWeight: "500" }}
              >
                {item.title}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
});

export default ContinueWatching;
