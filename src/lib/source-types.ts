export const SourceType = {
  RSS: "RSS",
  GENERIC_EDM_RSS: "GENERIC_EDM_RSS",
  LABEL_RADAR_RSS: "LABEL_RADAR_RSS",
  FUN_RADAR_RSS: "FUN_RADAR_RSS",
  YOUTUBE_CHANNEL_RSS: "YOUTUBE_CHANNEL_RSS",
  RA_NEWS_HTML: "RA_NEWS_HTML",
  BEATPORTAL_HTML: "BEATPORTAL_HTML",
  INSTAGRAM_HASHTAG: "INSTAGRAM_HASHTAG",
} as const;

export type SourceType = (typeof SourceType)[keyof typeof SourceType];

export const sourceTypeKeys = [
  SourceType.RSS,
  SourceType.GENERIC_EDM_RSS,
  SourceType.LABEL_RADAR_RSS,
  SourceType.FUN_RADAR_RSS,
  SourceType.YOUTUBE_CHANNEL_RSS,
  SourceType.RA_NEWS_HTML,
  SourceType.BEATPORTAL_HTML,
  SourceType.INSTAGRAM_HASHTAG,
] as const;

export const sourceTypeOptions = [
  { key: SourceType.RSS, label: "RSS / Atom" },
  { key: SourceType.GENERIC_EDM_RSS, label: "泛 EDM RSS" },
  { key: SourceType.LABEL_RADAR_RSS, label: "口碑厂牌 RSS" },
  { key: SourceType.FUN_RADAR_RSS, label: "趣闻雷达 RSS" },
  { key: SourceType.YOUTUBE_CHANNEL_RSS, label: "YouTube 频道 RSS" },
  { key: SourceType.RA_NEWS_HTML, label: "Resident Advisor Trance News" },
  { key: SourceType.BEATPORTAL_HTML, label: "Beatportal HTML" },
  { key: SourceType.INSTAGRAM_HASHTAG, label: "Instagram Hashtag Radar" },
] as const;
