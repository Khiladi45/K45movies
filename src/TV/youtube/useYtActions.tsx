import React, { useState } from "react";
import type { YtVideo } from "@/YouTube/types";
import { useYtHiddenStore, useYtLibraryStore } from "@/YouTube/store";
import TvDialog from "../components/TvDialog";

/**
 * Long-press OK on a YouTube card: Save / Not interested / Don't recommend
 * channel — the same store calls as the phone's 3-dot menu (no download or
 * share on TV).
 */
export function useYtActions() {
  const [target, setTarget] = useState<YtVideo | null>(null);
  const isSaved = useYtLibraryStore((s) => (target ? s.isSaved(target.id) : false));
  const toggleSaved = useYtLibraryStore((s) => s.toggleSaved);
  const hideVideo = useYtHiddenStore((s) => s.hideVideo);
  const hideChannel = useYtHiddenStore((s) => s.hideChannel);

  const dialog = (
    <TvDialog
      visible={!!target}
      title={target?.title || ""}
      subtitle={target?.channelName}
      actions={[
        {
          label: isSaved ? "Remove from Watchlist" : "Save to Watchlist",
          icon: isSaved ? "bookmark" : "bookmark-outline",
          onPress: () => target && toggleSaved(target),
        },
        {
          label: "Not interested",
          icon: "eye-off-outline",
          onPress: () => target && hideVideo(target.id),
        },
        ...(target?.channelName
          ? [
              {
                label: "Don't recommend channel",
                icon: "ban-outline" as const,
                destructive: true,
                onPress: () => target && hideChannel(target.channelName),
              },
            ]
          : []),
      ]}
      onClose={() => setTarget(null)}
    />
  );
  return { openActions: setTarget, dialog };
}
