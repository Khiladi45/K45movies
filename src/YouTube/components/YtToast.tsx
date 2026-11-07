import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useYtToastStore } from "../playerStore";

const logo = require("../../../assets/icon.png");

/** Dark pill with the app logo on the left; slides up, waits, slides away. */
export default function YtToast() {
  const insets = useSafeAreaInsets();
  const { message, id } = useYtToastStore();
  const [shown, setShown] = useState("");
  const slide = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!id || !message) return;
    setShown(message);
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(slide, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    timer.current = setTimeout(() => {
      Animated.timing(slide, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, 2600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!shown) return null;
  return (
    <View style={[styles.host, { bottom: insets.bottom + 72 }]} pointerEvents="none">
      <Animated.View
        style={[
          styles.toast,
          {
            opacity: slide,
            transform: [
              { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
            ],
          },
        ]}
      >
        <Image source={logo} style={styles.logo} contentFit="cover" />
        <Text style={styles.text} numberOfLines={2}>
          {shown}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: 16, right: 16, alignItems: "center", zIndex: 100 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: 420,
    backgroundColor: "#1f1f1f",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#3a3a3a",
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 16,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  logo: { width: 28, height: 28, borderRadius: 7 },
  text: { flexShrink: 1, color: "#f1f1f1", fontSize: 14, fontWeight: "500" },
});
