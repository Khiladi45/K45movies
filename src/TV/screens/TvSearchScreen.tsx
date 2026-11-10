import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTmdbSearch } from "@/hooks/useTmdb";
import Focusable from "../components/Focusable";
import PosterGrid from "../components/PosterGrid";
import { requestFocus } from "../focusMemory";
import { useOpenTvTitle } from "./TvHomeScreen";
import { TV } from "../theme";

/**
 * TV search. The search box is one focusable button; OK on it opens the TV's
 * own keyboard (and mic). The text field exists ONLY while typing and is
 * removed as soon as typing ends, then focus moves to the first result.
 *
 * Before, a text field nested inside a focusable box kept focus and its
 * keyboard connection after the keyboard closed: arrows could not reach the
 * results, and OK on a poster went to the text field ("search again")
 * instead of opening the movie.
 */
export default function TvSearchScreen() {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [typing, setTyping] = useState(false);
  const [focusResults, setFocusResults] = useState(false);
  const textRef = useRef("");
  textRef.current = text;
  const typingRef = useRef(false);
  typingRef.current = typing;
  const boxRef = useRef<View | null>(null);
  const firstResultRef = useRef<View | null>(null);
  const open = useOpenTvTitle();
  const { data, isFetching } = useTmdbSearch(query);

  const finishTyping = useCallback(() => {
    if (!typingRef.current) return;
    typingRef.current = false;
    Keyboard.dismiss();
    setTyping(false); // unmounts the text field
    setQuery(textRef.current);
    setFocusResults(true);
  }, []);

  // Closing the keyboard with Back also ends typing.
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", finishTyping);
    return () => sub.remove();
  }, [finishTyping]);

  // While typing, update the results after a short pause.
  useEffect(() => {
    if (!typing) return;
    const timer = setTimeout(() => setQuery(text), 600);
    return () => clearTimeout(timer);
  }, [text, typing]);

  // After typing: move focus to the first result (or back to the box).
  useEffect(() => {
    if (!focusResults || typing || isFetching) return;
    const timer = setTimeout(() => {
      setFocusResults(false);
      const hasResults = query.trim().length > 1 && (data?.length ?? 0) > 0;
      if (!(hasResults && requestFocus(firstResultRef))) requestFocus(boxRef);
    }, 120);
    return () => clearTimeout(timer);
  }, [focusResults, typing, isFetching, data, query]);

  return (
    <View style={styles.screen}>
      <View style={styles.searchRow}>
        <Focusable
          ref={boxRef}
          hasTVPreferredFocus
          style={styles.field}
          onPress={() => setTyping(true)}
          accessibilityLabel="Search: press OK to type"
        >
          <Ionicons name="search" size={20} color="#fff" />
          <Text style={[styles.fieldText, !text && styles.placeholder]} numberOfLines={1}>
            {typing ? " " : text || "Search movies and series"}
          </Text>
        </Focusable>
        {typing ? (
          // Mounted only while typing; never part of D-pad navigation.
          <TextInput
            autoFocus
            focusable={false}
            value={text}
            onChangeText={setText}
            onSubmitEditing={finishTyping}
            onBlur={finishTyping}
            placeholder="Search movies and series"
            placeholderTextColor={TV.muted}
            returnKeyType="search"
            style={styles.input}
          />
        ) : null}
        {isFetching ? <ActivityIndicator color="#fff" style={styles.spinner} /> : null}
      </View>
      {query.trim().length > 1 ? (
        <PosterGrid
          items={data || []}
          onOpen={open}
          firstRef={firstResultRef}
          empty={isFetching ? undefined : `Nothing found for “${query}”.`}
        />
      ) : (
        <Text style={styles.hint}>
          Press OK on the search box to type, or use the mic button on your remote.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TV.bg, paddingTop: TV.safeY + 8 },
  searchRow: {
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
  // Drawn over the box's text area while typing.
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
  hint: { color: TV.muted, fontSize: TV.text.body, marginHorizontal: TV.safeX },
});
