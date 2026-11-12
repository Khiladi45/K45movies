// YouTube layout — TV Watchlist: videos saved with "Save" (useYtLibraryStore),
// newest first. OK opens; hold OK to remove.
import React, { useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useYtLibraryStore } from "@/YouTube/store";
import type { YtVideo } from "@/YouTube/types";
import TvDialog from "../components/TvDialog";
import { TV } from "../theme";
import { useRestoreTvFocus } from "../useRestoreTvFocus";
import { useOpenYt } from "./TvYtHomeScreen";
import { YtShortCard, YtVideoCard } from "./YtTvCards";
import { chunk } from "./ytWatch";

export default function TvYtWatchlistScreen() {
  const saved = useYtLibraryStore((s) => s.saved);
  const removeSaved = useYtLibraryStore((s) => s.removeSaved);
  const { openVideo, openShorts } = useOpenYt();
  const [removing, setRemoving] = useState<YtVideo | null>(null);
  const firstRef = useRef<View | null>(null);
  useRestoreTvFocus(firstRef);

  const sorted = useMemo(() => [...saved].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)), [saved]);
  const videos = sorted.filter((v) => !v.isShort);
  const shorts = sorted.filter((v) => v.isShort);
  const rows = chunk(videos, TV.ytColumns);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Watchlist</Text>
      {sorted.length === 0 ? (
        <Text style={styles.empty}>Videos you Save (on a video page, or hold OK on a card) appear here.</Text>
      ) : (
        <>
          <Text style={styles.hint}>OK opens · hold OK to remove</Text>
          <FlatList
            data={rows}
            keyExtractor={(row) => row[0].id}
            contentContainerStyle={styles.content}
            removeClippedSubviews={false}
            ListHeaderComponent={
              shorts.length > 0 ? (
                <View style={styles.block}>
                  <Text style={styles.rowTitle}>Shorts</Text>
                  <FlatList
                    horizontal
                    data={shorts}
                    keyExtractor={(v) => v.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.shortsList}
                    removeClippedSubviews={false}
                    renderItem={({ item, index }) => (
                      <YtShortCard
                        ref={videos.length === 0 && index === 0 ? firstRef : undefined}
                        video={item}
                        onPress={() => openShorts(shorts, index)}
                        onLongPress={setRemoving}
                      />
                    )}
                  />
                </View>
              ) : null
            }
            renderItem={({ item: row, index: rowIndex }) => (
              <View style={styles.row}>
                {row.map((video, i) => (
                  <YtVideoCard
                    key={video.id}
                    ref={rowIndex === 0 && i === 0 ? firstRef : undefined}
                    video={video}
                    onPress={openVideo}
                    onLongPress={setRemoving}
                  />
                ))}
              </View>
            )}
          />
        </>
      )}
      <TvDialog
        visible={!!removing}
        title={removing?.title || ""}
        subtitle="Remove this video from your Watchlist?"
        actions={[
          {
            label: "Remove",
            icon: "trash-outline",
            destructive: true,
            onPress: () => removing && removeSaved(removing.id),
          },
        ]}
        onClose={() => setRemoving(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TV.bg, paddingTop: TV.safeY + 8 },
  title: { color: "#fff", fontSize: TV.text.title, fontWeight: "800", marginHorizontal: TV.safeX },
  hint: { color: TV.muted, fontSize: TV.text.small, marginHorizontal: TV.safeX, marginTop: 4, marginBottom: 12 },
  empty: { color: TV.muted, fontSize: TV.text.body, marginHorizontal: TV.safeX, marginTop: 12 },
  content: { paddingHorizontal: TV.safeX, paddingBottom: 40 },
  block: { marginBottom: 18 },
  rowTitle: { color: "#fff", fontSize: TV.text.row, fontWeight: "700", marginBottom: 8 },
  shortsList: { gap: TV.gap },
  row: { flexDirection: "row", gap: TV.gap + 4, marginBottom: 18 },
});
