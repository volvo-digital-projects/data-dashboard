type Video = { names: string[]; kind: string; views: number };
type Metrics = {
  subscribers?: number | null; totalViews?: number | null; averageViews?: number | null;
  videoCount?: number; long?: { count?: number; averageViews?: number | null };
  short?: { count?: number; averageViews?: number | null }; sharedVideos?: Video[];
};
const values = (metrics: Metrics, name?: string): (number | null | undefined)[] => {
  if (name) {
    const videos = (metrics.sharedVideos ?? []).filter(video => video.names.includes(name));
    const views = videos.reduce((sum, video) => sum + video.views, 0);
    const average = (group: Video[]) => group.length ? Math.round(group.reduce((sum, video) => sum + video.views, 0) / group.length) : null;
    return [metrics.subscribers, views, average(videos), videos.length,
      videos.filter(video => video.kind === "long").length, average(videos.filter(video => video.kind === "long")),
      videos.filter(video => video.kind === "short").length, average(videos.filter(video => video.kind === "short"))];
  }
  return [metrics.subscribers, metrics.totalViews, metrics.averageViews, metrics.videoCount,
    metrics.long?.count, metrics.long?.averageViews, metrics.short?.count, metrics.short?.averageViews];
};
/** Compare successful collection snapshots, not the previous-day subscriber close. */
export function hasYouTubeIncrease(channel: Metrics & { previousMetrics?: Metrics }, sharedCreatorName?: string): boolean {
  if (!channel.previousMetrics) return false;
  const previous = values(channel.previousMetrics, sharedCreatorName);
  return values(channel, sharedCreatorName).some((value, index) =>
    typeof value === "number" && typeof previous[index] === "number" && value - previous[index]! >= 1);
}
