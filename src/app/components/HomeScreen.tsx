import type { ManagedLink } from "../native/managedSettings";
import { Gamepad2 } from "lucide-react";
import type { ContentItem } from "../App";
import { FeaturedHero } from "./FeaturedHero";
import { ContentRow } from "./ContentRow";
import { YouTubeShelves } from "./YouTubeShelves";
import { AppIconGrid } from "./AppIconGrid";
import { WeatherCard } from "./Weather";
import type { WeatherCache } from "../native/weather";

interface HomeScreenProps {
  appsLoading?: boolean;
  links?: ManagedLink[];
  onLink?: (link: ManagedLink) => void;
  touch: boolean;
  remoteMode: boolean;
  apps: ContentItem[];
  libraryItems: ContentItem[];
  youtubeItems: ContentItem[];
  recommendAfter?: number;
  featured: ContentItem | null;
  heroItem: ContentItem | null;
  standalone: boolean;
  onSelect: (item: ContentItem) => void;
  onLaunch: (item: ContentItem) => void;
  onHeroLaunch: (item: ContentItem) => void;
  onArtFailure?: (item: ContentItem) => void;
  weather?: { cache: WeatherCache | null; pending: boolean; place: string; paused: boolean } | null;
}

export function HomeScreen({ appsLoading = false, links = [], onLink, touch, remoteMode, apps, libraryItems, youtubeItems, recommendAfter, featured, heroItem,
  standalone, onSelect, onLaunch, onHeroLaunch, onArtFailure, weather }: HomeScreenProps) {
  const showWeather = touch && !!weather && (!!weather.cache || weather.pending);
  return (
      <div className={touch ? `touch-home ${libraryItems.length || youtubeItems.length || links.length || showWeather ? "" : "touch-home-only"}` : undefined}>
        {showWeather && <WeatherCard weather={weather.cache} place={weather.place} paused={weather.paused} />}
        {!touch && (heroItem ? (
          <FeaturedHero
            item={heroItem}
            onLaunch={() => onHeroLaunch(heroItem)}
            remoteMode={remoteMode}
          />
        ) : (
          <div className="h-[520px] flex items-center justify-center">
            <div className="text-center">
              <Gamepad2 className="w-12 h-12 text-[oklch(30%_0_0)] mx-auto mb-4" />
              <p className="text-[oklch(50%_0_0)] text-lg">No apps assigned to this device yet</p>
              <p className="text-[oklch(38%_0_0)] text-sm mt-1">
                {standalone ? "Install an app on this device to see it here" : "Deploy apps from ArborXR to see them here"}
              </p>
            </div>
          </div>
        ))}
        {touch && !appsLoading && !heroItem && !links.length && !youtubeItems.length && !libraryItems.length && (
          <div className="touch-home-empty">
            <p>No apps assigned to this device yet</p>
            <p>{standalone ? "Install an app on this device to see it here" : "Deploy apps from ArborXR to see them here"}</p>
          </div>
        )}

        <div className="pb-16 in-data-[input-mode=touch]:pb-4 space-y-2">
          {(apps.length > 0 || (touch && appsLoading)) && (touch ? <AppIconGrid loading={appsLoading} items={apps} onLaunch={onLaunch} /> : (
            <ContentRow
              title="Apps & Games"
              items={apps}
              selectedId={featured?.id ?? null}
              onSelect={onSelect}
              onLaunch={onLaunch}
              launchOnTap={touch}
            />
          ))}
          {touch && links.length > 0 && <section className="yt-shelf" aria-label="Links">
            <h2>Links</h2><div className="yt-channel-scroll">
              {links.map(link => <button type="button" key={link.url} className="app-icon yt-channel" onClick={() => onLink?.(link)} aria-label={`Open ${link.title}`}>
                <span className="managed-link-tile" aria-hidden="true">{new URL(link.url).hostname.replace(/^www\./, "").charAt(0).toUpperCase()}</span>
                <span className="app-icon-label">{link.title}</span>
              </button>)}
            </div>
          </section>}
          {libraryItems.length > 0 && (
            <ContentRow
              title="Books & Audio"
              items={libraryItems}
              selectedId={featured?.id ?? null}
              onSelect={onSelect}
              onLaunch={onLaunch}
              launchOnTap={touch}
            />
          )}
          {touch ? <YouTubeShelves items={youtubeItems} recommendAfter={recommendAfter} onLaunch={onLaunch} onArtFailure={onArtFailure} /> : youtubeItems.length > 0 && (
            <ContentRow
              title="YouTube"
              items={youtubeItems}
              selectedId={featured?.id ?? null}
              onSelect={onSelect}
              onLaunch={onLaunch}
              launchOnTap={touch}
              onArtFailure={onArtFailure}
            />
          )}
        </div>
      </div>

  );
}
