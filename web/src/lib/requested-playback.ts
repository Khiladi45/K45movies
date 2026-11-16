"use client";

import { useEffect, useEffectEvent, useRef } from "react";

export function useRequestedPlayback(ready: boolean, play: () => void, consume = true) {
  const handled = useRef(false);
  const request = useEffectEvent(play);
  useEffect(() => {
    if (!ready || handled.current || location.hash !== "#play") return;
    handled.current = true;
    if (consume) history.replaceState(history.state, "", location.pathname + location.search);
    request();
  }, [ready, consume]);
}
