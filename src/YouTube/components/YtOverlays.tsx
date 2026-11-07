import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { startDownload } from "@/services/downloadManager";
import { useYtStreamInfo } from "../hooks";
import { useYtHiddenStore, useYtLibraryStore } from "../store";
import { useYtUiStore } from "../playerStore";
import { notify, shareVideo } from "../utils";
import { YT } from "../theme";
import type { YtDownloadOption, YtVideo } from "../types";
import YtSheet from "./YtSheet";
import YtToast from "./YtToast";
import YtMiniPlayer from "./YtMiniPlayer";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function Item({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.item} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icon} size={24} color={YT.text} />
      <Text style={styles.itemText}>{label}</Text>
    </TouchableOpacity>
  );
}

function MenuSheet() {
  const video = useYtUiStore((s) => s.menuFor);
  const close = useYtUiStore((s) => s.closeMenu);
  const openDownload = useYtUiStore((s) => s.openDownload);
  const toggleSaved = useYtLibraryStore((s) => s.toggleSaved);
  const saved = useYtLibraryStore((s) => (video ? s.isSaved(video.id) : false));
  const hideVideo = useYtHiddenStore((s) => s.hideVideo);
  const hideChannel = useYtHiddenStore((s) => s.hideChannel);
  // Keep the last video while the sheet animates out.
  const [last, setLast] = useState<YtVideo | null>(null);
  if (video && video !== last) setLast(video);
  const v = video ?? last;

  return (
    <YtSheet visible={!!video} onClose={close}>
      {v ? (
        <View style={{ paddingBottom: 8 }}>
          <Item
            icon={saved ? "bookmark" : "bookmark-outline"}
            label={saved ? "Remove from Watchlist" : "Add to Watchlist"}
            onPress={() => {
              close();
              notify(toggleSaved(v) ? "Saved to Watchlist" : "Removed from Watchlist");
            }}
          />
          <Item icon="download-outline" label="Download" onPress={() => openDownload(v)} />
          <Item
            icon="arrow-redo-outline"
            label="Share"
            onPress={() => {
              close();
              shareVideo(v);
            }}
          />
          <Item
            icon="eye-off-outline"
            label="Not interested"
            onPress={() => {
              hideVideo(v.id);
              close();
              notify("Okay, we'll show fewer videos like this");
            }}
          />
          {v.channelName ? (
            <Item
              icon="ban-outline"
              label="Don't recommend this channel"
              onPress={() => {
                hideChannel(v.channelName);
                close();
                notify(`Hiding videos from ${v.channelName}`);
              }}
            />
          ) : null}
        </View>
      ) : null}
    </YtSheet>
  );
}

function DownloadSheet() {
  const video = useYtUiStore((s) => s.downloadFor);
  const close = useYtUiStore((s) => s.closeDownload);
  const [last, setLast] = useState<YtVideo | null>(null);
  if (video && video !== last) setLast(video);
  const v = video ?? last;
  const info = useYtStreamInfo(v?.link ?? "", !!video);
  const [busy, setBusy] = useState(false);

  const begin = async (option?: YtDownloadOption) => {
    if (!v || busy) return;
    setBusy(true);
    const result = await startDownload({
      link: v.link,
      title: v.title,
      providerId: "youtube",
      type: "movie",
      image: v.image,
      stream: option?.video,
      audioStream: option?.audio,
    });
    setBusy(false);
    close();
    notify(result.ok ? "Download started" : result.error || "Couldn't start download");
  };

  const downloads = info.data?.downloads ?? [];

  return (
    <YtSheet visible={!!video} onClose={close} title="Download video">
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} style={styles.dlList} bounces={false}>
        {info.isLoading ? (
          [0, 1, 2].map((i) => <View key={i} style={styles.skeleton} />)
        ) : downloads.length > 0 ? (
          downloads.map((o) => (
            <TouchableOpacity
              key={o.height}
              style={styles.dlRow}
              disabled={busy}
              onPress={() => begin(o)}
              accessibilityRole="button"
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.dlQuality}>{o.label}</Text>
                <Text style={styles.dlMeta}>{o.detail}</Text>
              </View>
              <Ionicons name="download-outline" size={22} color={YT.blue} />
            </TouchableOpacity>
          ))
        ) : (
          <View style={{ padding: 16, gap: 12 }}>
            <Text style={styles.dlMeta}>
              {info.isError
                ? "Couldn't load the available qualities."
                : "No separate qualities are available for this video."}
            </Text>
            <TouchableOpacity style={styles.primary} disabled={busy} onPress={() => begin()}>
              <Text style={styles.primaryText}>Download best available</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </YtSheet>
  );
}

/** Sheets and toast shared by every screen of the YouTube layout. */
const TAB_ROUTES = ["HomeTab", "Watchlist", "Profile", "Providers"];
const HIDE_MINI_ON = ["YtVideo", "Shorts", "Player"];

export default function YtOverlays({ routeName }: { routeName?: string }) {
  const insets = useSafeAreaInsets();
  const showMini = !!routeName && !HIDE_MINI_ON.includes(routeName);
  // Above the footer on tab screens, above the gesture bar elsewhere.
  const miniBottom = (TAB_ROUTES.includes(routeName ?? "") ? 50 + insets.bottom : insets.bottom) + 12;
  return (
    <>
      {showMini ? <YtMiniPlayer bottom={miniBottom} /> : null}
      <MenuSheet />
      <DownloadSheet />
      <YtToast />
    </>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: "row", alignItems: "center", gap: 18, paddingHorizontal: 20, paddingVertical: 14 },
  itemText: { color: YT.text, fontSize: 15 },
  dlList: { maxHeight: 360 },
  dlRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  dlQuality: { color: YT.text, fontSize: 16, fontWeight: "600" },
  dlMeta: { color: YT.muted, fontSize: 13, marginTop: 2 },
  skeleton: { height: 56, marginHorizontal: 20, marginVertical: 6, borderRadius: 8, backgroundColor: "#2a2a2a" },
  primary: { backgroundColor: YT.blue, borderRadius: 20, paddingVertical: 10, alignItems: "center" },
  primaryText: { color: "#000", fontWeight: "700" },
});
