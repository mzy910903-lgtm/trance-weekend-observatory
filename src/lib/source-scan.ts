import { SubmissionStatus } from "@/lib/categories";
import { fetchFeed } from "@/lib/feeds";
import { fetchBeatportalHtml, fetchRaNewsHtml } from "@/lib/html-sources";
import { fetchInstagramHashtagRadar } from "@/lib/instagram-sources";
import { judgeNewsRecency } from "@/lib/news-recency";
import { prisma } from "@/lib/prisma";
import {
  filterCoreTranceItems,
  filterFunRadarItems,
  filterGenericEdmItems,
  filterLabelRadarItems,
  filterYouTubeItems,
} from "@/lib/source-filters";
import { SourceType } from "@/lib/source-types";
import { classifyTranceScope } from "@/lib/trance-relevance";

type ScanSource = { name: string; type: string; feedUrl: string };

function relevanceMessage(
  label: string,
  total: number,
  items: Awaited<ReturnType<typeof fetchFeed>>["items"],
  source: ScanSource,
) {
  const core = items.filter(
    (item) =>
      classifyTranceScope({
        title: item.title,
        url: item.url,
        rawExcerpt: item.excerpt,
        source,
      }) === "CORE",
  ).length;
  const context = items.length - core;

  return `${label}：主线 ${core} 条，相邻 ${context} 条，过滤无关 ${total - items.length} 条。`;
}

async function fetchSourceItems(source: ScanSource) {
  if (source.type === SourceType.RA_NEWS_HTML) {
    const feed = await fetchRaNewsHtml(source.feedUrl);
    const items = filterCoreTranceItems(feed.items, source);
    return {
      ...feed,
      items,
      message: relevanceMessage("RA 传思筛选", feed.items.length, items, source),
    };
  }

  if (source.type === SourceType.BEATPORTAL_HTML) {
    return fetchBeatportalHtml(source.feedUrl);
  }

  if (source.type === SourceType.INSTAGRAM_HASHTAG) {
    return fetchInstagramHashtagRadar(source.feedUrl);
  }

  const feed = await fetchFeed(source.feedUrl);

  if (source.type === SourceType.GENERIC_EDM_RSS) {
    const items = filterGenericEdmItems(feed.items, source);
    return {
      ...feed,
      items,
      message: relevanceMessage("泛 EDM 传思筛选", feed.items.length, items, source),
    };
  }

  if (source.type === SourceType.LABEL_RADAR_RSS) {
    const items = filterLabelRadarItems(feed.items, source);
    return {
      ...feed,
      items,
      message: relevanceMessage("口碑厂牌筛选", feed.items.length, items, source),
    };
  }

  if (source.type === SourceType.FUN_RADAR_RSS) {
    const items = filterFunRadarItems(feed.items, source);
    return {
      ...feed,
      items,
      message: relevanceMessage("趣闻传思筛选", feed.items.length, items, source),
    };
  }

  if (source.type === SourceType.YOUTUBE_CHANNEL_RSS) {
    const items = filterYouTubeItems(feed.items);
    return {
      ...feed,
      items,
      message: `YouTube 过滤：${feed.items.length} 条中保留 ${items.length} 条公告/阵容/访谈线索。`,
    };
  }

  const items = filterCoreTranceItems(feed.items, source);
  return {
    ...feed,
    items,
    message: relevanceMessage("传思筛选", feed.items.length, items, source),
  };
}

export async function scanSource(
  sourceId: string,
  options?: { maxSourceAgeDays?: number },
) {
  const source = await prisma.source.findUnique({ where: { id: sourceId } });

  if (!source) {
    return { ok: false, created: 0, error: "来源不存在。" };
  }

  if (!source.feedUrl) {
    return { ok: false, created: 0, error: "来源缺少 RSS/Atom URL。" };
  }

  try {
    const feed = await fetchSourceItems({
      name: source.name,
      type: source.type,
      feedUrl: source.feedUrl,
    });
    let created = 0;
    let skippedOld = 0;

    for (const item of feed.items) {
      const recency = judgeNewsRecency(
        {
          title: item.title,
          url: item.url,
          rawExcerpt: item.excerpt,
          publishedAt: item.publishedAt,
        },
        new Date(),
        options?.maxSourceAgeDays,
      );

      if (!recency.accepted) {
        skippedOld += 1;
        continue;
      }

      const exists = await prisma.submission.findFirst({
        where: { url: item.url },
        select: { id: true },
      });

      if (exists) continue;

      await prisma.submission.create({
        data: {
          url: item.url,
          nickname: source.name,
          note: item.excerpt
            ? `来源扫描发现：${item.title}\n${item.excerpt}`
            : `来源扫描发现：${item.title}`,
          status: SubmissionStatus.PENDING,
          rawTitle: item.title,
          rawExcerpt: item.excerpt,
          rawPublishedAt: item.publishedAt,
          sourceId: source.id,
          discoveredAt: item.publishedAt ?? new Date(),
        },
      });
      created += 1;
    }

    await prisma.source.update({
      where: { id: source.id },
      data: {
        lastScannedAt: new Date(),
        lastScanStatus: "SUCCESS",
        lastScanMessage: [
          `新增 ${created} 条 pending 资讯`,
          skippedOld > 0 ? `跳过 ${skippedOld} 条旧闻` : null,
          feed.message?.replace(/[。.!！]+$/g, ""),
        ]
          .filter(Boolean)
          .join("，")
          .concat("。"),
        lastScanNewItems: created,
        lastSuccessfulScanAt: new Date(),
      },
    });

    return { ok: true, created };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "来源扫描失败。";

    await prisma.source.update({
      where: { id: source.id },
      data: {
        lastScannedAt: new Date(),
        lastScanStatus: "FAILED",
        lastScanMessage: message.slice(0, 500),
        lastScanNewItems: 0,
      },
    });

    return { ok: false, created: 0, error: message };
  }
}
