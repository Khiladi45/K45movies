import React, { forwardRef, memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Focusable from "../components/Focusable";
import { TV } from "../theme";
import { usePostFocusStore } from "./postFocusStore";
import type { ProviderPost } from "./posts";

type Props = {
  post: ProviderPost;
  onPress: (post: ProviderPost) => void;
  /** Feeds the home hero when focused. */
  catalogTitle?: string;
  reportFocus?: boolean;
  onFocus?: () => void;
  /** Long-press OK (e.g. remove from Watchlist). */
  onLongPress?: (post: ProviderPost) => void;
  hasTVPreferredFocus?: boolean;
};

/** A provider post poster (2:3) for TV rows and grids. */
export const PostCard = memo(
  forwardRef<View, Props>(function PostCard(
    { post, onPress, catalogTitle, reportFocus = true, onFocus, onLongPress, hasTVPreferredFocus },
    ref,
  ) {
    return (
      <Focusable
        ref={ref}
        grow
        hasTVPreferredFocus={hasTVPreferredFocus}
        style={styles.card}
        onPress={() => onPress(post)}
        onLongPress={onLongPress ? () => onLongPress(post) : undefined}
        onFocus={() => {
          if (reportFocus) usePostFocusStore.getState().setFocused({ ...post, catalogTitle });
          onFocus?.();
        }}
        accessibilityLabel={post.title}
      >
        {post.image ? (
          <Image
            source={{ uri: post.image }}
            style={styles.image}
            contentFit="cover"
            transition={150}
            recyclingKey={post.link}
          />
        ) : (
          <View style={[styles.image, styles.noImage]}>
            <Text style={styles.noImageText} numberOfLines={4}>
              {post.title}
            </Text>
          </View>
        )}
      </Focusable>
    );
  }),
);

/** End-of-row card that opens the full category grid. */
export function SeeAllCard({ onPress, onFocus }: { onPress: () => void; onFocus?: () => void }) {
  return (
    <Focusable
      grow
      style={[styles.card, styles.seeAll]}
      onPress={onPress}
      onFocus={onFocus}
      accessibilityLabel="See all"
    >
      <Text style={styles.seeAllText}>See all</Text>
      <Text style={styles.seeAllArrow}>›</Text>
    </Focusable>
  );
}

export const postCardStyles = StyleSheet.create({
  card: {
    width: TV.poster.width,
    height: TV.poster.height,
    overflow: "hidden",
    backgroundColor: TV.surface,
  },
});

const styles = StyleSheet.create({
  card: postCardStyles.card,
  image: { width: "100%", height: "100%", borderRadius: TV.radius - 2 },
  noImage: { alignItems: "center", justifyContent: "center", padding: 8 },
  noImageText: { color: "#fff", fontSize: TV.text.small, textAlign: "center" },
  seeAll: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  seeAllText: { color: "#fff", fontSize: TV.text.body, fontWeight: "700" },
  seeAllArrow: { color: "#fff", fontSize: 28, fontWeight: "300", marginTop: 2 },
});
