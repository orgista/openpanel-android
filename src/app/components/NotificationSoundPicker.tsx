import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { SystemBridge, type NotificationSoundState } from "../native/SystemBridge";

export function NotificationSoundGroup({ state, managed, onPick }: {
  state: NotificationSoundState; managed?: boolean; onPick: (id: string) => void;
}) {
  return (
    <div className="mb-12">
      <h3 className="text-xl text-[oklch(98.5%_0_0)] mb-6" style={{ fontWeight: 500 }}>Notification Sound</h3>
      <div className="system-list bg-[oklch(26.9%_0_0)] rounded-lg">
        {state.sounds.map((sound) => (
          <button
            key={sound.id}
            type="button"
            disabled={!state.canWrite}
            aria-pressed={state.selected === sound.id}
            onClick={() => onPick(sound.id)}
            className="system-list-row settings-value-row w-full text-left text-[oklch(98%_0_0)]"
          >
            {sound.title}
            {!state.canWrite ? <span>{managed ? "Managed by ArborXR" : "Not allowed"}</span>
              : state.selected === sound.id && <Check className="w-5 h-5 text-[oklch(72%_0.19_142)] shrink-0" />}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NotificationSoundPicker({ managed }: { managed?: boolean }) {
  const [state, setState] = useState<NotificationSoundState | null>(null);
  useEffect(() => {
    void SystemBridge.getNotificationSounds().then(setState).catch(() => {});
  }, []);
  if (!state || state.sounds.length === 0) return null;
  const pick = (id: string) => {
    void SystemBridge.previewNotificationSound({ id }).catch(() => {});
    void SystemBridge.setNotificationSound({ id })
      .then(() => setState((current) => current && { ...current, selected: id }))
      .catch(() => {});
  };
  return <NotificationSoundGroup state={state} managed={managed} onPick={pick} />;
}
