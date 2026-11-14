"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useLibrary } from "@/lib/library";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

export function SearchDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function openWithShortcut(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.key.toLowerCase() !== "k") return;
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setOpen(true);
    }

    window.addEventListener("keydown", openWithShortcut);
    return () => window.removeEventListener("keydown", openWithShortcut);
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    if (query.length < 2) return;
    useLibrary.getState().addSearch(query);
    setOpen(false);
    router.push("/search?" + new URLSearchParams({ q: query }));
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="search-trigger" aria-keyshortcuts="Control+K Meta+K">
        {children}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="search-dialog">
          <div className="flex items-center justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">Search titles</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label="Close search">
              <X size={19} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Search the selected catalog for a movie or series.</Dialog.Description>
          <form onSubmit={submit} className="mt-4 flex gap-2">
            <input name="q" type="search" aria-label="Title" placeholder="Movie or series"
              className="field min-w-0 flex-1" minLength={2} maxLength={120} required />
            <button className="primary-button" type="submit"><Search size={17} aria-hidden="true" /> Search</button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
