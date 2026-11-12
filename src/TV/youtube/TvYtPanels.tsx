// YouTube TV side panels (reuse the player's focus-trapped SidePanel):
// Quality / Captions / Speed options and read-only Comments.
import React, { useMemo } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SidePanel } from "@/player/PlayerSidePanels";
import { useYtComments } from "@/YouTube/hooks";
import Focusable from "../components/Focusable";
import { TV } from "../theme";

export type TvYtOption = { key: string; label: string; detail?: string; selected?: boolean; onPress: () => void };

export function OptionsPanel({
  title,
  options,
  note,
  onClose,
}: {
  title: string;
  options: TvYtOption[];
  note?: string;
  onClose: () => void;
}) {
  const focusIndex = Math.max(0, options.findIndex((o) => o.selected));
  return (
    <SidePanel title={title} width={320} onClose={onClose}>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <FlatList
        data={options}
        keyExtractor={(o) => o.key}
        removeClippedSubviews={false}
        renderItem={({ item, index }) => (
          <Focusable
            hasTVPreferredFocus={index === focusIndex}
            style={styles.row}
            onPress={() => {
              item.onPress();
              onClose();
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowText, item.selected && styles.selected]}>{item.label}</Text>
              {item.detail ? <Text style={styles.detail}>{item.detail}</Text> : null}
            </View>
            {item.selected ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
          </Focusable>
        )}
      />
    </SidePanel>
  );
}

/** Read-only comments; Up/Down scroll, the list loads more near the end. */
export function CommentsPanel({ link, onClose }: { link: string; onClose: () => void }) {
  const query = useYtComments(link);
  const comments = useMemo(
    () => (query.data?.pages ?? []).flatMap((p: any) => p.comments ?? []),
    [query.data],
  );
  const count = query.data?.pages?.[0]?.count;
  const more = () => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  };
  return (
    <SidePanel title={count ? `Comments · ${count}` : "Comments"} width={400} onClose={onClose}>
      {query.isLoading ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />
      ) : comments.length === 0 ? (
        <Text style={styles.note}>No comments.</Text>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(c: any, i) => c.id || String(i)}
          removeClippedSubviews={false}
          onEndReached={more}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            query.isFetchingNextPage ? <ActivityIndicator color="#fff" style={{ marginVertical: 12 }} /> : null
          }
          renderItem={({ item, index }) => (
            // Each comment is focusable so Up/Down can scroll the list.
            <Focusable
              hasTVPreferredFocus={index === 0}
              style={styles.comment}
              onFocus={() => {
                if (index >= comments.length - 4) more();
              }}
            >
              <Text style={styles.author} numberOfLines={1}>
                {item.author}
                <Text style={styles.detail}>{item.publishedTime ? `  ·  ${item.publishedTime}` : ""}</Text>
              </Text>
              <Text style={styles.body}>{item.text}</Text>
              {item.likes ? <Text style={styles.detail}>👍 {item.likes}</Text> : null}
            </Focusable>
          )}
        />
      )}
    </SidePanel>
  );
}

const styles = StyleSheet.create({
  note: { color: TV.muted, fontSize: TV.text.small, marginBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  rowText: { color: "rgba(255,255,255,0.85)", fontSize: TV.text.body, fontWeight: "600" },
  selected: { color: "#fff", fontWeight: "800" },
  detail: { color: TV.muted, fontSize: TV.text.small, fontWeight: "500" },
  comment: { paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6 },
  author: { color: "#fff", fontSize: TV.text.small, fontWeight: "800" },
  body: { color: "rgba(255,255,255,0.9)", fontSize: TV.text.body, marginTop: 3, lineHeight: 18 },
});
