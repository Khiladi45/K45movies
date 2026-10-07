import React from "react";
import { Animated } from "react-native";

export const skeletonPulse = new Animated.Value(0.4);
Animated.loop(
  Animated.sequence([
    Animated.timing(skeletonPulse, {
      toValue: 0.8,
      duration: 700,
      useNativeDriver: true,
    }),
    Animated.timing(skeletonPulse, {
      toValue: 0.4,
      duration: 700,
      useNativeDriver: true,
    }),
  ]),
).start();

export default function Skeleton({ style }: any) {
  return (
    <Animated.View
      style={[
        { backgroundColor: "#1a1a1a", borderRadius: 8, opacity: skeletonPulse },
        style,
      ]}
    />
  );
}
