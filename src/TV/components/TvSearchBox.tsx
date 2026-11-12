import React, { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Focusable from "./Focusable";
import { TV } from "../theme";

/**
 * TV search box for the Provider Based and YouTube layouts — the same proven
 * pattern as the Movie layout's TvSearchScreen (which is unchanged):
 * one focusable box; OK opens the TV keyboard (and mic); the TextInput exists
 * ONLY while typing and is never nested in the focusable; typing ends on
 * submit, blur or keyboard hide (keyboard dismissed, field removed) and the
 * parent then moves focus to its results.
 */
const TvSearchBox = forwardRef<
  View,
  {
    text: string;
    onChangeText: (text: string) => void;
    /** Typing finished: run the search for this text. */
    onDone: (text: string) => void;
    placeholder: string;
    busy?: boolean;
    hasTVPreferredFocus?: boolean;
  }
>(function TvSearchBox(
  { text, onChangeText, onDone, placeholder, busy, hasTVPreferredFocus = true },
  ref,
) {
  const [typing, setTyping] = useState(false);
  const typingRef = useRef(false);
  typingRef.current = typing;
  const textRef = useRef(text);
  textRef.current = text;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const finishTyping = useCallback(() => {
    if (!typingRef.current) return;
    typingRef.current = false;
    Keyboard.dismiss();
    setTyping(false); // unmounts the text field
    doneRef.current(textRef.current);
  }, []);

  // Closing the keyboard with Back also ends typing.
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", finishTyping);
    return () => sub.remove();
  }, [finishTyping]);

  return (
    <View style={styles.row}>
      <Focusable
        ref={ref}
        hasTVPreferredFocus={hasTVPreferredFocus}
        style={styles.field}
        onPress={() => setTyping(true)}
        accessibilityLabel="Search: press OK to type"
      >
        <Ionicons name="search" size={20} color="#fff" />
        <Text style={[styles.fieldText, !text && styles.placeholder]} numberOfLines={1}>
          {typing ? " " : text || placeholder}
        </Text>
      </Focusable>
      {typing ? (
        // Mounted only while typing; never part of D-pad navigation.
        <TextInput
          autoFocus
          focusable={false}
          value={text}
          onChangeText={onChangeText}
          onSubmitEditing={finishTyping}
          onBlur={finishTyping}
          placeholder={placeholder}
          placeholderTextColor={TV.muted}
          returnKeyType="search"
          style={styles.input}
        />
      ) : null}
      {busy ? <ActivityIndicator color="#fff" style={styles.spinner} /> : null}
    </View>
  );
});

export default TvSearchBox;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: TV.safeX,
    marginBottom: 18,
  },
  field: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    height: 46,
    backgroundColor: TV.surface,
  },
  fieldText: { flex: 1, color: "#fff", fontSize: TV.text.row },
  placeholder: { color: TV.muted },
  input: {
    position: "absolute",
    left: 46,
    right: 14,
    height: 46,
    color: "#fff",
    fontSize: TV.text.row,
    padding: 0,
  },
  spinner: { marginLeft: 12 },
});
