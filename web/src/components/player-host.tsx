"use client";

import dynamic from "next/dynamic";
import { usePlayback } from "@/lib/playback";

const BrowserPlayer = dynamic(() => import("./browser-player").then((module) => module.BrowserPlayer), { ssr: false });

export function PlayerHost() {
  const session = usePlayback((state) => state.session);
  const sessionId = usePlayback((state) => state.sessionId);
  return session ? <BrowserPlayer key={sessionId} session={session} /> : null;
}
