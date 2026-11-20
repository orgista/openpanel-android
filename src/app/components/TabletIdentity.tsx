import { Cat, Dog, Rabbit, Bird, Fish, Rocket, Star, Sun, Moon, Flower, TreePine, Car, Bike, Music, Gamepad2, Palette } from "lucide-react";
import type { TabletPreferences } from "../native/tabletAppearance";

const icons = { cat: Cat, dog: Dog, rabbit: Rabbit, bird: Bird, fish: Fish, rocket: Rocket, star: Star,
  sun: Sun, moon: Moon, flower: Flower, tree: TreePine, car: Car, bike: Bike, music: Music, gamepad: Gamepad2, palette: Palette };

export function TabletAvatar({ tabletIcon, tabletColor, size }: Pick<TabletPreferences, "tabletIcon" | "tabletColor"> & { size: number }) {
  const Icon = icons[tabletIcon];
  return <span className="tablet-avatar" style={{ width: size, height: size, background: tabletColor }} aria-hidden="true">
    <Icon size={size * .58} strokeWidth={1.8} />
  </span>;
}

export function TabletIdentity({ preferences, lock = false }: { preferences: TabletPreferences; lock?: boolean }) {
  if (!preferences.tabletName) return null;
  return <div className={lock ? "tablet-identity tablet-identity-lock" : "tablet-identity"}>
    <TabletAvatar {...preferences} size={lock ? 64 : 28} />
    <span>{preferences.tabletName}</span>
  </div>;
}
