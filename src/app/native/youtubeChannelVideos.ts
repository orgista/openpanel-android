import { SystemBridge } from "./SystemBridge";

type ChannelPage = Awaited<ReturnType<typeof SystemBridge.getYouTubeChannelVideos>>;
const pages = new Map<string, { expires: number; page: Promise<ChannelPage> }>();

export function getYouTubeChannelVideos(channelId: string, pageToken?: string, refresh = false): Promise<ChannelPage> {
  if (pageToken) return SystemBridge.getYouTubeChannelVideos({ channelId, pageToken });
  const cached = pages.get(channelId);
  if (!refresh && cached && cached.expires > Date.now()) return cached.page;
  const page = SystemBridge.getYouTubeChannelVideos({ channelId });
  pages.set(channelId, { expires: Date.now() + 5 * 60_000, page });
  void page.catch(() => { if (pages.get(channelId)?.page === page) pages.delete(channelId); });
  return page;
}
