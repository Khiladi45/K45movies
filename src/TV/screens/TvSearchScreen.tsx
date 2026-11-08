import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTmdbSearch } from "@/hooks/useTmdb";
import Focusable from "../components/Focusable";
import PosterGrid from "../components/PosterGrid";
import { useOpenTvTitle } from "./TvHomeScreen";
import { TV } from "../theme";

/**
 * Search with the TV's own keyboard: selecting the field opens the system
 * keyboard, which on most Android TVs also offers voice input from the
 * remote's mic button.
 */
export default function TvSearchScreen() {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const input = useRef<TextInput>(null);
  const open = useOpenTvTitle();
  const { data, isFetching } = useTmdbSearch(query);

  // Search while typing, after a short pause.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text), 450);
    return () => clearTimeout(timer);
  }, [text]);

  return (
    <View style={styles.screen}>
      <Focusable
        hasTVPreferredFocus
        style={styles.field}
        onPress={() => input.current?.focus()}
        accessibilityLabel="Search"
      >
        <Ionicons name="search" size={20} color="#fff" />
        <TextInput
          ref={input}
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => setQuery(text)}
          placeholder="Search movies and series"
          placeholderTextColor={TV.muted}
          returnKeyType="search"
          style={styles.input}
        />
        {isFetching ? <ActivityIndicator color="#fff" /> : null}
      </Focusable>
      {query.trim().length > 1 ? (
        <PosterGrid
          items={data || []}
          onOpen={open}
          empty={isFetching ? undefined : `Nothing found for “${query}”.`}
        />
      ) : (
        <Text style={styles.hint}>
          Select the search box to type, or use the mic button on your remote.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TV.bg, paddingTop: TV.safeY + 8 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: TV.safeX,
    marginBottom: 18,
    paddingHorizontal: 14,
    height: 46,
    backgroundColor: TV.surface,
  },
  input: { flex: 1, color: "#fff", fontSize: TV.text.row, padding: 0 },
  hint: { color: TV.muted, fontSize: TV.text.body, marginHorizontal: TV.safeX },
});
