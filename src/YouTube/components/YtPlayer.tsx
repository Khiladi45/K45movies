import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import Video, { ResizeMode } from "react-native-video";
import { useYtPlayback } from "../hooks";
import { YT } from "../theme";

export type YtPlayerHandle = {
  enterFullscreen: () => void;
  enterPip: () => boolean;
};

type Props = {
  /** YouTube watch / shorts URL. Resolved through the provider's stream(). */
  link: string;
  /** A downloaded file. When set, no provider call is made (works offline). */
  localUri?: string;
  paused?: boolean;
  repeat?: boolean;
  /** Native transport controls (the video page). Shorts use none. */
  controls?: boolean;
  resizeMode?: "contain" | "cover";
  /** Resolve streams only when true, so off-screen Shorts stay idle. */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  onEnd?: () => void;
};

/**
 * One video surface shared by the video page and the Shorts player. It resolves
 * streams, falls back to the next candidate when one fails, and exposes
 * fullscreen and Picture-in-Picture to the page that owns the buttons.
 */
const YtPlayer = forwardRef<YtPlayerHandle, Props>(function YtPlayer(
  {
    link,
    localUri,
    paused = false,
    repeat = false,
    controls = false,
    resizeMode = "contain",
    active = true,
    style,
    onEnd,
  },
  ref,
) {
  const videoRef = useRef<any>(null);
  const playback = useYtPlayback(link, active && !localUri);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const streams = playback.data?.streams ?? [];
  const start = playback.data?.startIndex ?? 0;

  // A new video (or fresh playback data) starts from the best candidate again.
  useEffect(() => {
    setIndex(start);
    setFailed(false);
    setLoaded(false);
  }, [link, localUri, playback.data, start]);

  useImperativeHandle(ref, () => ({
    enterFullscreen: () => {
      try {
        videoRef.current?.presentFullscreenPlayer?.();
      } catch {}
    },
    enterPip: () => {
      try {
        if (videoRef.current?.enterPictureInPicture) {
          videoRef.current.enterPictureInPicture();
          return true;
        }
      } catch {}
      return false;
    },
  }));

  const stream = streams[index];

  const source = useMemo(() => {
    if (localUri) return { uri: localUri };
    if (!stream) return undefined;
    const headers = stream.headers || {};
    return {
      uri: stream.link,
      ...(stream.format === "hls" ? { type: "m3u8" } : {}),
      ...(stream.format === "dash" ? { type: "mpd" } : {}),
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    };
  }, [localUri, stream]);

  const onError = () => {
    if (!localUri && index + 1 < streams.length) {
      setLoaded(false);
      setIndex(index + 1);
    } else {
      setFailed(true);
    }
  };

  const retry = () => {
    setFailed(false);
    setLoaded(false);
    if (localUri) return;
    if (streams.length > 1) setIndex(start);
    else playback.refetch();
  };

  const resolving = !localUri && active && playback.isLoading;
  const noStream =
    !localUri && active && !playback.isLoading && (playback.isError || streams.length === 0);

  return (
    <View style={[styles.box, style]}>
      {source && !failed ? (
        <Video
          key={`${source.uri}`}
          ref={videoRef}
          style={StyleSheet.absoluteFill}
          source={source as any}
          paused={paused}
          repeat={repeat}
          controls={controls}
          resizeMode={resizeMode === "cover" ? ResizeMode.COVER : ResizeMode.CONTAIN}
          onLoad={() => setLoaded(true)}
          onError={onError}
          onEnd={onEnd}
          playWhenInactive
          enterPictureInPictureOnLeave={controls}
        />
      ) : null}

      {(resolving || (source && !loaded && !failed)) && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color="#fff" />
        </View>
      )}

      {(noStream || failed) && (
        <View style={styles.overlay}>
          <Text style={styles.error}>This video couldn't be played.</Text>
          <TouchableOpacity style={styles.retry} onPress={noStream ? () => playback.refetch() : retry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

export default YtPlayer;

const styles = StyleSheet.create({
  box: { backgroundColor: "#000", overflow: "hidden" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  error: { color: "#fff", fontSize: 13 },
  retry: { backgroundColor: YT.surface, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  retryText: { color: "#fff", fontWeight: "600", fontSize: 13 },
});
