import React, { forwardRef, useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useThemeStore } from "@/store/useThemeStore";
import { TV } from "../theme";

type Props = Omit<PressableProps, "children" | "style"> & {
  children: ReactNode | ((focused: boolean) => ReactNode);
  style?: StyleProp<ViewStyle>;
  /** Extra style while focused (merged after the default focus ring). */
  focusedStyle?: StyleProp<ViewStyle>;
  /** Grow slightly while focused (posters, cards). */
  grow?: boolean;
  /** Draw the accent ring while focused (default true). */
  ring?: boolean;
  hasTVPreferredFocus?: boolean;
};

/**
 * Everything the remote can land on. Shows a clear accent ring (and optional
 * zoom) on focus so the user always knows where they are.
 */
const Focusable = forwardRef<View, Props>(function Focusable(
  {
    children,
    style,
    focusedStyle,
    grow = false,
    ring = true,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const primaryColor = useThemeStore((s) => s.primaryColor);
  return (
    <Pressable
      ref={ref}
      focusable
      {...rest}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        styles.base,
        style,
        focused && ring ? { borderColor: primaryColor } : null,
        focused && grow ? { transform: [{ scale: TV.focusScale }] } : null,
        focused ? focusedStyle : null,
      ]}
    >
      {typeof children === "function" ? children(focused) : children}
    </Pressable>
  );
});

export default Focusable;

const styles = StyleSheet.create({
  base: {
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: TV.radius,
  },
});
