import type { SourceAttempt } from "@/lib/catalog-types";

export function SourceAttempts({ attempts }: { attempts: SourceAttempt[] }) {
  if (!attempts.length) return null;
  return <ul aria-label="Server checks" className="mt-2 space-y-1 break-words text-sm">
    {attempts.map(({ server, quality, probe }, index) => <li key={index}>
      {[server, quality, probe.httpStatus && "HTTP " + probe.httpStatus, probe.contentType,
        probe.reason || probe.status].filter(Boolean).join(" · ")}
    </li>)}
  </ul>;
}
