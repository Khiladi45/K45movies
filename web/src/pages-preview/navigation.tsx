import type { ComponentProps } from "react";

type LinkProps = ComponentProps<"a"> & { prefetch?: boolean };

export default function Link({ prefetch, ...props }: LinkProps) {
  void prefetch;
  return <a {...props} />;
}

const router = { prefetch() {}, back() { history.back(); } };
export function useRouter() { return router; }
