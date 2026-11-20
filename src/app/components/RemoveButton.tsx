import { useEffect, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";

const CONFIRM_WINDOW_MS = 4000;

interface RemoveButtonProps {
  /** Name of the thing being removed, for the accessible labels. */
  itemTitle: string;
  onRemove: () => void;
  disabled?: boolean;
  /** Replaces the trash icon, e.g. with a spinner while the removal runs. */
  icon?: ReactNode;
  className: string;
  /** Text on the armed button; matches the first label when that is not "Remove". */
  confirmLabel?: string;
}

/**
 * Two-step remove: the first press arms the button and shows "Remove", the
 * second press removes. It disarms after a few seconds or when focus leaves,
 * so a child tapping around (or a stray remote press) can't delete content.
 */
export function RemoveButton({ itemTitle, onRemove, disabled, icon, className, confirmLabel = "Remove" }: RemoveButtonProps) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), CONFIRM_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onRemove();
      }}
      onBlur={() => setArmed(false)}
      aria-label={armed ? `Confirm removing ${itemTitle}` : `Remove ${itemTitle}`}
      className={armed
        ? "shrink-0 rounded-lg bg-[oklch(57.7%_0.245_27.325)] px-4 py-2 text-sm text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80"
        : className}
      style={armed ? { fontWeight: 500 } : undefined}
    >
      {armed ? confirmLabel : (icon ?? <Trash2 className="size-4" />)}
    </button>
  );
}
