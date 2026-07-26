export const ArticleCategory = {
  NEWS: "NEWS",
  TRACK: "TRACK",
  LABEL: "LABEL",
  LIVE: "LIVE",
  MEME: "MEME",
  ARCHIVE: "ARCHIVE",
} as const;

export type ArticleCategory =
  (typeof ArticleCategory)[keyof typeof ArticleCategory];

export const ArticleStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;

export const SubmissionStatus = {
  PENDING: "PENDING",
  ANALYZED: "ANALYZED",
  PUBLISHED: "PUBLISHED",
  REJECTED: "REJECTED",
} as const;

export type SubmissionStatus =
  (typeof SubmissionStatus)[keyof typeof SubmissionStatus];

export const categories = [
  {
    key: ArticleCategory.NEWS,
    slug: "news",
    label: "新闻",
    description: "场景动态、艺人动向、平台消息和会影响听歌生活的公开资讯。",
  },
  {
    key: ArticleCategory.TRACK,
    slug: "tracks",
    label: "新歌",
    description: "新单曲、混音、EP 与那些让合成器突然发光的旋律线索。",
  },
  {
    key: ArticleCategory.LABEL,
    slug: "labels",
    label: "厂牌",
    description: "厂牌发行、企划、目录变化，以及地下频谱里的组织结构。",
  },
  {
    key: ArticleCategory.LIVE,
    slug: "live",
    label: "现场",
    description: "演出、音乐节、俱乐部现场和凌晨以后才说得清的舞池消息。",
  },
  {
    key: ArticleCategory.MEME,
    slug: "memes",
    label: "梗",
    description: "社区笑话、低频幻觉、评论区考古和不宜太认真但很准确的东西。",
  },
  {
    key: ArticleCategory.ARCHIVE,
    slug: "archive",
    label: "考古",
    description: "旧新闻、老歌、历史现场和那些值得从硬盘深处请回来的记忆。",
  },
] as const;

export function categoryBySlug(slug: string) {
  return categories.find((category) => category.slug === slug);
}

export function categoryLabel(key: string) {
  return categories.find((category) => category.key === key)?.label ?? "新闻";
}
