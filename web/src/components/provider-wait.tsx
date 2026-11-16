"use client";

import { useEffect, useState } from "react";

export function ProviderWait({ message }: { message: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const timer = setInterval(() => setElapsed(Math.floor((performance.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  return <p role="status" className="mt-2 text-sm text-muted">
    {elapsed >= 8 ? "Still waiting for the provider to respond…" : message}
    <span aria-hidden="true"> {elapsed}s</span>
  </p>;
}
