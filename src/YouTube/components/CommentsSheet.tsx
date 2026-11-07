import React, { memo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useYtComments } from "../hooks";
import { YT } from "../theme";
import type { YtComment } from "../types";
import YtSheet from "./YtSheet";

function Avatar({ uri, name }: { uri?: string; name: string }) {
  return uri ? (
    <Image source={{ uri }} style={styles.avatar} contentFit="cover" />
  ) : (
    <View style={[styles.avatar, styles.avatarFallback]}>
      <Text style={styles.avatarText}>{(name.replace("@", "")[0] || "?").toUpperCase()}</Text>
    </View>
  );
}

const Row = memo(function Row({
  link,
  comment,
  isReply,
}: {
  link: string;
  comment: YtComment;
  isReply?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const replies = useYtComments(link, comment.replyToken, open && !!comment.replyToken);
  const items = replies.data?.pages.flatMap((p) => p.comments) ?? [];
  const count = Number(String(comment.replyCount).replace(/\D/g, "")) || 0;
  return (
    <View style={[styles.row, isReply && styles.reply]}>
      <Avatar uri={comment.authorAvatar} name={comment.author} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.meta} numberOfLines={1}>
          {comment.author}
          {comment.publishedTime ? `  ·  ${comment.publishedTime}` : ""}
        </Text>
        <Text style={styles.text}>{comment.text}</Text>
        <View style={styles.foot}>
          <Ionicons name="thumbs-up-outline" size={16} color={YT.muted} />
          <Text style={styles.footText}>{comment.likes || ""}</Text>
          <Ionicons name="thumbs-down-outline" size={16} color={YT.muted} style={{ marginLeft: 14 }} />
        </View>
        {!isReply && comment.replyToken && (count > 0 || comment.replyCount) ? (
          <TouchableOpacity onPress={() => setOpen((v) => !v)} accessibilityRole="button">
            <Text style={styles.repliesBtn}>
              {open ? "Hide replies" : `${comment.replyCount || count} replies`}
            </Text>
          </TouchableOpacity>
        ) : null}
        {open ? (
          <View style={{ marginTop: 6 }}>
            {items.map((r) => (
              <Row key={r.id} link={link} comment={r} isReply />
            ))}
            {replies.isLoading ? <ActivityIndicator color={YT.muted} style={{ padding: 8 }} /> : null}
            {replies.hasNextPage ? (
              <TouchableOpacity onPress={() => replies.fetchNextPage()} disabled={replies.isFetchingNextPage}>
                <Text style={styles.repliesBtn}>{replies.isFetchingNextPage ? "Loading…" : "Show more replies"}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
});

type Props = { visible: boolean; onClose: () => void; link: string };

/** Comments in a bottom sheet (video page and Shorts). Pages load as you scroll. */
export default function CommentsSheet({ visible, onClose, link }: Props) {
  const q = useYtComments(link, undefined, visible);
  const comments = q.data?.pages.flatMap((p) => p.comments) ?? [];
  const count = q.data?.pages[0]?.count;
  return (
    <YtSheet visible={visible} onClose={onClose} title={count ? `Comments · ${count}` : "Comments"} heightRatio={0.72}>
      {q.isLoading ? (
        <View style={{ padding: 16, gap: 18 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ flexDirection: "row", gap: 12 }}>
              <View style={[styles.avatar, { backgroundColor: "#2a2a2a" }]} />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={{ height: 11, width: "40%", borderRadius: 4, backgroundColor: "#2a2a2a" }} />
                <View style={{ height: 12, width: "90%", borderRadius: 4, backgroundColor: "#2a2a2a" }} />
              </View>
            </View>
          ))}
        </View>
      ) : q.isError && comments.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Couldn't load comments.</Text>
          <TouchableOpacity style={styles.retry} onPress={() => q.refetch()}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : comments.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No comments yet.</Text>
        </View>
      ) : (
        <FlatList showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}
          data={comments}
          keyExtractor={(c, i) => `${c.id}-${i}`}
          renderItem={({ item }) => <Row link={link} comment={item} />}
          initialNumToRender={8}
          windowSize={7}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          onEndReachedThreshold={1}
          ListFooterComponent={
            q.isFetchingNextPage ? <ActivityIndicator color={YT.muted} style={{ padding: 16 }} /> : <View style={{ height: 16 }} />
          }
        />
      )}
    </YtSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  reply: { paddingHorizontal: 0 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarFallback: { backgroundColor: "#3a3a3a", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  meta: { color: YT.muted, fontSize: 12 },
  text: { color: YT.text, fontSize: 14, lineHeight: 19 },
  foot: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 2 },
  footText: { color: YT.muted, fontSize: 12 },
  repliesBtn: { color: YT.blue, fontSize: 13, fontWeight: "600", paddingVertical: 4 },
  empty: { padding: 32, alignItems: "center", gap: 12 },
  emptyText: { color: YT.muted, fontSize: 14 },
  retry: { backgroundColor: YT.surface, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 18 },
  retryText: { color: YT.text, fontWeight: "600" },
});
