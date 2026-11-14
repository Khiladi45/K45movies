"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { avatars, useLibrary, type Avatar, type Profile } from "@/lib/library";
import { useCatalogReady } from "./catalog-context";

const colors: Record<Avatar, string> = {
  Violet: "#6d28d9", Ocean: "#0369a1", Emerald: "#047857", Gold: "#92400e", Rose: "#be123c",
};

function Portrait({ profile }: { profile: Profile }) {
  return <span className="profile-avatar" style={{ backgroundColor: colors[profile.avatar] }}>
    {profile.photo
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={profile.photo} alt="" /> : profile.name.slice(0, 1).toUpperCase()}
  </span>;
}

async function readPhoto(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8_000_000) throw new Error("Choose a JPEG, PNG or WebP under 8 MB.");
  const photo = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const drawing = canvas.getContext("2d");
    if (!drawing) throw new Error("Could not resize the photo.");
    const size = Math.min(photo.width, photo.height);
    drawing.drawImage(photo, (photo.width - size) / 2, (photo.height - size) / 2, size, size, 0, 0, 128, 128);
    return canvas.toDataURL("image/webp", 0.8);
  } finally { photo.close(); }
}

function ProfileForm({ profile, close }: { profile: Profile | null; close: () => void }) {
  const [avatar, setAvatar] = useState<Avatar>(profile?.avatar ?? "Violet");
  const [photo, setPhoto] = useState(profile?.photo);
  const [notice, setNotice] = useState("");
  const [reading, setReading] = useState(false);
  const save = useLibrary((state) => state.saveProfile);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    if (!name) { setNotice("Enter a profile name."); return; }
    try { save({ name, avatar, photo }, profile?.id); close(); }
    catch { setNotice("Could not save to browser storage."); }
  }

  return <form className="mt-4 grid gap-4" onSubmit={submit}>
    <label className="grid gap-1 text-sm font-medium">Name
      <input className="field" name="name" defaultValue={profile?.name} maxLength={40} autoComplete="off" required />
    </label>
    <fieldset><legend className="mb-2 text-sm font-medium">Avatar</legend>
      <div className="flex flex-wrap gap-2">
        {avatars.map((value) => <button key={value} type="button" className="chip" aria-pressed={avatar === value && !photo}
          onClick={() => { setAvatar(value); setPhoto(undefined); }}>{value}</button>)}
      </div>
    </fieldset>
    <label className="grid gap-1 text-sm font-medium">Upload or take a photo
      <input type="file" accept="image/jpeg,image/png,image/webp" className="field text-sm" disabled={reading} onChange={async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setReading(true);
        setNotice("");
        try { setPhoto(await readPhoto(file)); }
        catch (err) { setNotice(err instanceof Error ? err.message : "Could not read the photo."); }
        finally { setReading(false); }
      }} />
    </label>
    {photo && <Portrait profile={{ id: "", name: "", avatar, photo }} />}
    {notice && <p role="alert" className="text-sm text-muted">{notice}</p>}
    <button type="submit" className="primary-button justify-self-start" disabled={reading}>{profile ? "Save changes" : "Create profile"}</button>
  </form>;
}

export function LocalProfiles() {
  const ready = useCatalogReady();
  const profiles = useLibrary((state) => state.profiles);
  const active = useLibrary((state) => state.activeProfile);
  const select = useLibrary((state) => state.selectProfile);
  const remove = useLibrary((state) => state.removeProfile);
  const [editing, setEditing] = useState<Profile | null>();
  const [notice, setNotice] = useState("");
  const open = editing !== undefined;
  const trigger = useRef<HTMLButtonElement>(null);

  return <section className="max-w-2xl">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">Local profiles</h2>
      <button type="button" className="secondary-button" disabled={!ready} onClick={(event) => { trigger.current = event.currentTarget; setEditing(null); }}><Plus size={16} /> Add profile</button>
    </div>
    {ready && (!profiles.length ? <p className="text-sm text-muted">No local profiles yet.</p> : <ul className="grid gap-3">
      {profiles.map((profile) => <li key={profile.id} className="list-row flex-wrap">
        <Portrait profile={profile} />
        <span className="min-w-20 flex-1 truncate font-semibold">{profile.name}</span>
        {active === profile.id ? <span className="chip"><Check size={15} /> Active</span> :
          <button type="button" className="secondary-button" aria-label={"Use " + profile.name}
            onClick={() => { select(profile.id); setNotice(profile.name + " is active."); }}>Use profile</button>}
        <button type="button" className="icon-button" aria-label={"Edit " + profile.name} onClick={(event) => { trigger.current = event.currentTarget; setEditing(profile); }}><Pencil size={17} /></button>
        <button type="button" className="icon-button" aria-label={"Delete " + profile.name} onClick={() => {
          if (window.confirm("Delete " + profile.name + "?")) { remove(profile.id); setNotice(profile.name + " deleted."); }
        }}><Trash2 size={17} /></button>
      </li>)}
    </ul>)}
    <p className="mt-2 text-sm text-muted" role="status">{notice}</p>
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) setEditing(undefined); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="search-dialog max-h-[75dvh] overflow-auto" onCloseAutoFocus={(event) => {
          event.preventDefault();
          trigger.current?.focus();
        }}>
          <div className="flex items-center justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">{editing ? "Edit profile" : "Add profile"}</Dialog.Title>
            <Dialog.Close asChild><button type="button" aria-label="Close profile" className="icon-button"><X size={20} /></button></Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">This profile is stored in this browser.</Dialog.Description>
          {open && <ProfileForm profile={editing} close={() => setEditing(undefined)} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </section>;
}
