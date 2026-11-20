import { useEffect, useRef, useState } from "react";
import { TabletPhotos } from "./LibraryBridge";
import type { TabletPhoto } from "./tabletAppearance";

export function photoStatus(error: unknown): string {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case "PHOTO_CANCELLED": return "Cancelled";
    case "PHOTO_STORAGE_FULL": return "Storage full";
    case "PHOTO_LIMIT": return "12 photos maximum";
    case "PHOTO_PICKER_FAILED": return "Picker unavailable";
    default: return "Could not read photo";
  }
}

export function useTabletPhotos(enabled: boolean) {
  const [photos, setPhotos] = useState<TabletPhoto[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const inFlight = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void TabletPhotos.listTabletPhotos().then(result => {
      if (active) { setPhotos(result.photos); setReady(true); }
    }).catch(() => { if (active) setStatus("Photos unavailable"); });
    return () => { active = false; };
  }, [enabled]);

  const add = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setStatus("");
    try {
      const { photo } = await TabletPhotos.importTabletPhoto();
      setPhotos(current => [...current, photo]);
      setStatus("Photo added");
    } catch (error) { setStatus(photoStatus(error)); }
    finally { inFlight.current = false; setBusy(false); }
  };

  const remove = async (id: string): Promise<boolean> => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true); setStatus("");
    try {
      const { removed } = await TabletPhotos.removeTabletPhoto({ id });
      if (!removed) { setStatus("Could not remove photo"); return false; }
      setPhotos(current => current.filter(photo => photo.id !== id));
      setStatus("Photo removed");
      return true;
    } catch { setStatus("Could not remove photo"); return false; }
    finally { inFlight.current = false; setBusy(false); }
  };
  return { photos, ready, busy, status, add, remove };
}
