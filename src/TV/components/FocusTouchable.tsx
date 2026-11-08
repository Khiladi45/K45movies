import React, { forwardRef, useState } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  type TouchableOpacityProps,
} from "react-native";
import { IS_TV } from "../isTV";

type Ref = React.ComponentRef<typeof TouchableOpacity>;

/**
 * Drop-in TouchableOpacity. Phones get exactly TouchableOpacity. On TV the
 * remote-focused control gets a white ring instead of react-native-tvos's
 * default focus dimming (which makes the focused item look disabled).
 */
const FocusTouchable = forwardRef<Ref, TouchableOpacityProps>(function FocusTouchable(
  props,
  ref,
) {
  const [focused, setFocused] = useState(false);
  if (!IS_TV) return <TouchableOpacity ref={ref} {...props} />;
  return (
    <TouchableOpacity
      ref={ref}
      activeOpacity={0.85}
      {...props}
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        props.onBlur?.(event);
      }}
      style={[styles.base, props.style, focused ? styles.focused : null]}
    />
  );
});

export default FocusTouchable;

const styles = StyleSheet.create({
  base: { borderWidth: 2, borderColor: "transparent" },
  focused: { borderColor: "#ffffff", backgroundColor: "rgba(255,255,255,0.12)" },
});
