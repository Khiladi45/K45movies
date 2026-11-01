import React, { memo } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import Skeleton from "@/components/Skeleton";
import { useThemeStore } from "@/store/useThemeStore";
import { useTmdbRow } from "@/hooks/useTmdb";
import { tmdbImage, type TmdbItem, type TmdbMediaType } from "@/lib/tmdbApi";

export type TitleRef = {
  id: number;
  mediaType: TmdbMediaType;
  title: string;
  poster: string | null;
  year?: string;
  rating?: number;
};

export const formatRuntime = (minutes?: number | null): string => {
  if (!minutes || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/** Opens the Movie Based details screen for a TMDB title. */
export function useOpenTitle() {
  const navigation = useNavigation<any>();
  return (item: Pick<TitleRef, "id" | "mediaType" | "title">) =>
    navigation.navigate("TmdbDetail", {
      id: item.id,
      mediaType: item.mediaType,
      title: item.title,
    });
}

export const PosterCard = memo(function PosterCard({
  item,
  width = 128,
  onPress,
}: {
  item: TitleRef;
  width?: number;
  onPress: () => void;
}) {
  const uri = tmdbImage(item.poster, "w342");
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{ width }}
      accessibilityLabel={item.title}
    >
      <View style={[styles.poster, { width, height: width * 1.5 }]}>
        {uri ? (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.noPoster}>
            <Ionicons name="film-outline" size={28} color="#444" />
          </View>
        )}
        {item.mediaType === "tv" ? (
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>SERIES</Text>
          </View>
        ) : null}
        {item.rating ? (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={10} color="#facc15" />
            <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.title}
      </Text>
      {item.year ? <Text style={styles.cardYear}>{item.year}</Text> : null}
    </TouchableOpacity>
  );
});

export function RowHeader({ title }: { title: string }) {
  const { primaryColor } = useThemeStore();
  return (
    <View style={styles.rowHeader}>
      <View style={[styles.accent, { backgroundColor: primaryColor }]} />
      <Text style={styles.rowTitle} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

function RowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton style={{ width: 130, height: 18, borderRadius: 4, marginBottom: 14 }} />
      <View style={{ flexDirection: "row", gap: 14 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: 128 }}>
            <Skeleton style={{ width: 128, height: 192, borderRadius: 10 }} />
            <Skeleton style={{ width: 96, height: 12, borderRadius: 4, marginTop: 8 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** A titled horizontal row of TMDB posters that loads itself. */
export const TmdbRow = memo(function TmdbRow({
  title,
  rowKey,
  fetcher,
  enabled = true,
}: {
  title: string;
  rowKey: string;
  fetcher: (signal?: AbortSignal) => Promise<TmdbItem[]>;
  enabled?: boolean;
}) {
  const open = useOpenTitle();
  const { data, isLoading, isError, refetch, isRefetching } = useTmdbRow(
    rowKey,
    fetcher,
    enabled,
  );

  if (!enabled) return null;
  if (isLoading) return <RowSkeleton />;
  if (isError) {
    return (
      <View style={styles.row}>
        <RowHeader title={title} />
        <TouchableOpacity
          onPress={() => refetch()}
          disabled={isRefetching}
          style={styles.retry}
        >
          <Ionicons name="refresh-outline" size={15} color="#ef4444" />
          <Text style={styles.retryText}>
            {isRefetching ? "Retrying…" : "Couldn't load — tap to retry"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!data || data.length === 0) return null;

  return (
    <View style={styles.row}>
      <RowHeader title={title} />
      <FlatList
        data={data}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => `${item.mediaType}:${item.id}`}
        ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
        renderItem={({ item }) => (
          <PosterCard item={item} onPress={() => open(item)} />
        )}
      />
    </View>
  );
});

export function MissingKeyNotice() {
  return (
    <View style={styles.missing}>
      <Ionicons name="key-outline" size={44} color="#666" />
      <Text style={styles.missingTitle}>TMDB key not set</Text>
      <Text style={styles.missingText}>
        Add EXPO_PUBLIC_TMDB_KEY to your .env file and rebuild the app to use
        the Movie Based layout.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  poster: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  noPoster: { flex: 1, alignItems: "center", justifyContent: "center" },
  typeBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  typeBadgeText: { color: "#fff", fontSize: 8.5, fontWeight: "800", letterSpacing: 0.6 },
  ratingBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  ratingText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  cardTitle: { color: "#fff", fontSize: 13, marginTop: 8, fontWeight: "500" },
  cardYear: { color: "#777", fontSize: 11, marginTop: 2 },
  row: { marginBottom: 24, paddingLeft: 16 },
  rowHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, paddingRight: 16 },
  accent: { width: 4, height: 18, borderRadius: 2 },
  rowTitle: { color: "#fff", fontSize: 19, fontWeight: "700", flex: 1 },
  retry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  retryText: { color: "#ef4444", fontSize: 12.5, fontWeight: "600" },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", padding: 36, gap: 10 },
  missingTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  missingText: { color: "#888", fontSize: 13.5, textAlign: "center", lineHeight: 20 },
});
