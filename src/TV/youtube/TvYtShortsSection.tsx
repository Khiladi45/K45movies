// YouTube layout — "Shorts" rail section: a grid of Shorts (OK opens the
// full-screen Shorts player at that Short).
import React, { useRef } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { DEFAULT_SHORTS_QUERY } from "@/YouTube/api";
import { useYtShorts } from "@/YouTube/hooks";
import { useYtHiddenStore } from "@/YouTube/store";
import Focusable from "../components/Focusable";
import { TV } from "../theme";
import { useRestoreTvFocus } from "../useRestoreTvFocus";
import { useOpenYt } from "./TvYtHomeScreen";
import { YtShortCard } from "./YtTvCards";
import { useYtActions } from "./useYtActions";
import { withoutHidden } from "./ytRows";
import { chunk } from "./ytWatch";

export const SHORTS_COLUMNS = 7;

export default function TvYtShortsSection() {
  const shorts = useYtShorts(DEFAULT_SHORTS_QUERY);
  const hiddenVideos = useYtHiddenStore((s) => s.videos);
  const hiddenChannels = useYtHiddenStore((s) => s.channels);
  const items = withoutHidden(shorts.data ?? [], hiddenVideos, hiddenChannels);
  const rows = chunk(items, SHORTS_COLUMNS);
  const { openShorts } = useOpenYt();
  const { openActions, dialog } = useYtActions();
  const firstRef = useRef<View | null>(null);
  useRestoreTvFocus(firstRef);

  const more = (rowIndex: number) => {
    if (rowIndex >= rows.length - 2 && shorts.hasNextPage && !shorts.isFetchingNextPage) void shorts.fetchNextPage();
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Shorts</Text>
      {shorts.isLoading ? (
        <ActivityIndicator color="#fff" size="large" style={{ marginTop: 40 }} />
      ) : shorts.isError ? (
        <Focusable style={styles.retry} onPress={() => shorts.refetch()}>
          <Text style={styles.retryText}>Couldn't load Shorts — press OK to retry</Text>
        </Focusable>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row[0].id}
          contentContainerStyle={styles.content}
          removeClippedSubviews={false}
          initialNumToRender={3}
          windowSize={7}
          ListFooterComponent={
            shorts.isFetchingNextPage ? <ActivityIndicator color="#fff" style={{ marginVertical: 16 }} /> : null
          }
          renderItem={({ item: row, index: rowIndex }) => (
            <View style={styles.row}>
              {row.map((short, i) => (
                <YtShortCard
                  key={short.id}
                  ref={rowIndex === 0 && i === 0 ? firstRef : undefined}
                  video={short}
                  onPress={() => openShorts(items, rowIndex * SHORTS_COLUMNS + i, DEFAULT_SHORTS_QUERY)}
                  onLongPress={openActions}
                  onFocus={() => more(rowIndex)}
                />
              ))}
            </View>
          )}
        />
      )}
      {dialog}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TV.bg, paddingTop: TV.safeY + 8 },
  title: { color: "#fff", fontSize: TV.text.title, fontWeight: "800", marginHorizontal: TV.safeX, marginBottom: 12 },
  content: { paddingHorizontal: TV.safeX, paddingBottom: 40 },
  row: { flexDirection: "row", gap: TV.gap + 4, marginBottom: 18 },
  retry: {
    alignSelf: "flex-start",
    marginHorizontal: TV.safeX,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(239,68,68,0.15)",
  },
  retryText: { color: "#fca5a5", fontSize: TV.text.body, fontWeight: "600" },
});
