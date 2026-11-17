// Provider Based layout — TV Watchlist: a poster grid from useWatchlistStore
// (newest first). OK opens the title; long-press OK offers removal.
import React, { useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useWatchlistStore } from "@/store/useWatchlistStore";
import TvDialog from "../components/TvDialog";
import { TV } from "../theme";
import { useRestoreTvFocus } from "../useRestoreTvFocus";
import { PostCard } from "./PostCard";
import type { ProviderPost } from "./posts";
import { useOpenProviderPost } from "./TvProviderHomeScreen";

export const WATCHLIST_COLUMNS = 7;

export default function TvProviderWatchlistScreen() {
  const movies = useWatchlistStore((s) => s.movies);
  const removeFromWatchlist = useWatchlistStore((s) => s.removeFromWatchlist);
  const open = useOpenProviderPost();
  const [removing, setRemoving] = useState<ProviderPost | null>(null);
  const firstRef = useRef<View | null>(null);
  useRestoreTvFocus(firstRef);

  const items = useMemo<ProviderPost[]>(
    () =>
      [...movies]
        .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
        .map((m) => ({
          title: m.title,
          link: m.link,
          image: m.image,
          type: m.type,
          providerId: m.providerId,
        })),
    [movies],
  );

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Watchlist</Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>
          Titles you add with “Watchlist” on a title page appear here.
        </Text>
      ) : (
        <>
          <Text style={styles.hint}>OK opens · hold OK to remove</Text>
          <FlatList
            data={items}
            numColumns={WATCHLIST_COLUMNS}
            keyExtractor={(item) => item.link}
            contentContainerStyle={styles.content}
            columnWrapperStyle={styles.gridRow}
            removeClippedSubviews={false}
            renderItem={({ item, index }) => (
              <PostCard
                ref={index === 0 ? firstRef : undefined}
                post={item}
                reportFocus={false}
                onPress={open}
                onLongPress={setRemoving}
              />
            )}
          />
        </>
      )}
      <TvDialog
        visible={!!removing}
        title={removing?.title || ""}
        subtitle="Remove this title from your Watchlist?"
        actions={[
          {
            label: "Remove from Watchlist",
            icon: "trash-outline",
            destructive: true,
            onPress: () => removing && removeFromWatchlist(removing.link),
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
  gridRow: { gap: TV.gap, marginBottom: TV.gap + 4 },
});
