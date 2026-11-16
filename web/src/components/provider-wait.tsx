"use client";

import { useEffect, useState } from "react";

export function ProviderWait({ message }: { message: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, []);
  return <p role="status" className="mt-2 text-sm text-muted">
    {slow ? "Still waiting for the provider to respond…" : message}
  </p>;
}
