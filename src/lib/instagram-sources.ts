import type { FeedItem, FeedScanResult } from "@/lib/feeds";
import { filterInstagramItems } from "@/lib/source-filters";

type InstagramRecentMedia = {
  id?: string;
  caption?: string;
  permalink?: string;
  timestamp?: string;
  username?: string;
};

function hashtagFromUrl(value: string) {
  try {
    const url = new URL(value);
    const tag = url.pathname.split("/").filter(Boolean).pop();
    return tag?.replace(/^#/, "") ?? "";
  } catch {
    return value.replace(/^#/, "").trim();
  }
}

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function graphBaseUrl() {
  const version = process.env.INSTAGRAM_GRAPH_API_VERSION || "v21.0";
  return `https://graph.facebook.com/${version}`;
}

async function graphGet<T>(path: string, params: Record<string, string>) {
  const url = new URL(`${graphBaseUrl()}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, { next: { revalidate: 0 } });
  if (!response.ok) {
    throw new Error(`Instagram radar 扫描失败：HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchInstagramHashtagRadar(
  feedUrl: string,
): Promise<FeedScanResult> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  const hashtag = hashtagFromUrl(feedUrl);

  if (!accessToken || !userId || !hashtag) {
    return {
      title: `Instagram #${hashtag || "hashtag"} Radar`,
      items: [],
      message:
        "Instagram radar 未配置 INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_USER_ID，已跳过。",
    };
  }

  const search = await graphGet<{ data?: { id: string }[] }>(
    "ig_hashtag_search",
    {
      user_id: userId,
      q: hashtag,
      access_token: accessToken,
    },
  );
  const hashtagId = search.data?.[0]?.id;

  if (!hashtagId) {
    return {
      title: `Instagram #${hashtag} Radar`,
      items: [],
      message: `Instagram radar 未找到 #${hashtag}。`,
    };
  }

  const recent = await graphGet<{ data?: InstagramRecentMedia[] }>(
    `${hashtagId}/recent_media`,
    {
      user_id: userId,
      fields: "id,caption,permalink,timestamp,username",
      access_token: accessToken,
      limit: "30",
    },
  );

  const items = (recent.data ?? [])
    .map((media): FeedItem | null => {
      if (!media.permalink) return null;
      const caption = (media.caption ?? "").replace(/\s+/g, " ").trim();
      const title = caption
        ? `Instagram #${hashtag}: ${caption.slice(0, 90)}`
        : `Instagram #${hashtag} signal`;

      return {
        title,
        url: media.permalink,
        publishedAt: parseDate(media.timestamp),
        excerpt: [
          `Instagram hashtag radar: #${hashtag}`,
          media.username ? `@${media.username}` : null,
          caption,
        ]
          .filter(Boolean)
          .join("\n")
          .slice(0, 500),
      };
    })
    .filter((item): item is FeedItem => Boolean(item));

  return {
    title: `Instagram #${hashtag} Radar`,
    items: filterInstagramItems(items).slice(0, 30),
  };
}
