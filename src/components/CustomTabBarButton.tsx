// components/FlyingHeroOverlay.tsx
import React, { useEffect, useRef } from "react";
import { Animated, Image, Dimensions, StyleSheet } from "react-native";

const { width, height } = Dimensions.get("window");

// Swap this for your own asset (owned/licensed PNG, sprite sheet, or Lottie source)
const HERO_IMAGE = require("../../assets/hero-flying.png");

interface FlyingHeroOverlayProps {
  duration?: number; // ms for one flight pass
  loop?: boolean;
  imageSize?: number;
}

export default function FlyingHeroOverlay({
  duration = 5000,
  loop = true,
  imageSize = 120,
}: FlyingHeroOverlayProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const flight = Animated.timing(progress, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    });

    if (loop) {
      Animated.loop(flight).start();
    } else {
      flight.start();
    }
  }, [duration, loop, progress]);

  // Diagonal path: bottom-left -> top-right, with a little arc via translateY
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-imageSize, width + imageSize],
  });

  const translateY = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [height * 0.7, height * 0.25, height * 0.5],
  });

  const rotate = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["-8deg", "4deg", "-8deg"],
  });

  const scale = progress.interpolate({
    inputRange: [0, 0.15, 0.85, 1],
    outputRange: [0.6, 1, 1, 0.6],
  });

  const opacity = progress.interpolate({
    inputRange: [0, 0.1, 0.9, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          width: imageSize,
          height: imageSize,
          opacity,
          transform: [{ translateX }, { translateY }, { rotate }, { scale }],
        },
      ]}
    >
      <Image
        source={HERO_IMAGE}
        style={{ width: "100%", height: "100%" }}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 999,
  },
});
