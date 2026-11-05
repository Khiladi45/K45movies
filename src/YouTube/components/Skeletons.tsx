import React from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Skeleton from "@/components/Skeleton";
import { YT } from "../theme";

export function FeedSkeleton({ count = 3 }: { count?: number }) {
  const { width } = useWindowDimensions();
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ marginBottom: 20 }}>
          <Skeleton style={{ width, height: (width * 9) / 16, borderRadius: 0 }} />
          <View style={styles.meta}>
            <Skeleton style={styles.avatar} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton style={{ height: 14, width: "90%" }} />
              <Skeleton style={{ height: 12, width: "55%" }} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export function RowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton style={{ width: 168, height: 94, borderRadius: 8 }} />
          <View style={{ flex: 1, gap: 8, paddingTop: 4 }}>
            <Skeleton style={{ height: 13, width: "95%" }} />
            <Skeleton style={{ height: 13, width: "70%" }} />
            <Skeleton style={{ height: 11, width: "45%" }} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  meta: { flexDirection: "row", gap: 12, padding: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  row: { flexDirection: "row", gap: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: YT.bg },
});
