interface OpenPanelBrandProps {
  iconClassName?: string;
  wordmarkClassName?: string;
  showByline?: boolean;
  showIcon?: boolean;
}

export function OpenPanelBrand({
  iconClassName = "size-6",
  wordmarkClassName = "text-[1.375rem]",
  showByline = true,
  showIcon = false,
}: OpenPanelBrandProps) {
  return (
    <div className="inline-flex items-center gap-2.5" aria-label="OpenPanel by Orgista">
      {showIcon && (
        <svg
          viewBox="0 0 36 36"
          className={iconClassName}
          aria-hidden="true"
        >
          {/* Three panels and one swung open. */}
          <rect x="1" y="1" width="16" height="16" fill="#E2E8F0" />
          <rect x="1" y="19" width="16" height="16" fill="#E2E8F0" />
          <rect x="19" y="19" width="16" height="16" fill="#E2E8F0" />
          <path d="M19 17V1a16 16 0 0 1 16 16Z" fill="url(#op-bl)" />
          <defs>
            <linearGradient id="op-bl" x1="19" y1="1" x2="35" y2="17" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7DD3FC" />
              <stop offset="1" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
        </svg>
      )}
      <span className="inline-flex items-baseline gap-2">
        <span
          className={`text-[oklch(97%_0_0)] tracking-tight ${wordmarkClassName}`}
          style={{ fontWeight: 700 }}
        >
          OpenPanel
        </span>
        {showByline && (
          <span
            className="text-[oklch(62%_0_0)] tracking-widest uppercase"
            style={{ fontSize: "0.6rem", fontWeight: 500 }}
          >
            by Orgista™
          </span>
        )}
      </span>
    </div>
  );
}
