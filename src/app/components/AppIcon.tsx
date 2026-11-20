import type { CSSProperties } from "react";
import type { ContentItem } from "../App";
import { ArtImage, LetterAvatar } from "./ArtImage";

interface AppIconProps {
  item: Pick<ContentItem, "id" | "title" | "iconUrl" | "artBackgroundUrl" | "artForegroundUrl">;
  size?: number;
  onLaunch?: (item: AppIconProps["item"]) => void;
}

const layerStyle: CSSProperties = {
  position: "absolute", left: "-25%", top: "-25%", width: "150%", height: "150%",
  maxWidth: "none", objectFit: "fill",
};

export function AppIcon({ item, size = 148, onLaunch }: AppIconProps) {
  const art = (
    <>
      <span className="app-icon-plate" aria-hidden="true">
        {item.artBackgroundUrl ? (
          <>
            <ArtImage src={item.artBackgroundUrl} style={layerStyle} />
            {item.artForegroundUrl && <ArtImage src={item.artForegroundUrl} style={layerStyle} />}
          </>
        ) : item.iconUrl ? (
          <ArtImage src={item.iconUrl} className="app-icon-legacy" fallback={<LetterAvatar label={item.title} className="app-icon-legacy" />} />
        ) : <LetterAvatar label={item.title} className="app-icon-legacy" />}
      </span>
      <span className="app-icon-label">{item.title}</span>
    </>
  );
  const style = { "--app-icon-size": `${size}px` } as CSSProperties;
  return onLaunch ? (
    <button type="button" className="app-icon" style={style} aria-label={`Open ${item.title}`}
      data-content-id={item.id} onClick={() => onLaunch(item)}>{art}</button>
  ) : <div className="app-icon" style={style}>{art}</div>;
}
