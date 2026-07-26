import { SubmissionStatus } from "@/lib/categories";
import { fetchFeed } from "@/lib/feeds";
import { fetchBeatportalHtml, fetchRaNewsHtml } from "@/lib/html-sources";
import { fetchInstagramHashtagRadar } from "@/lib/instagram-sources";
import { judgeNewsRecency } from "@/lib/news-recency";
import { prisma } from "@/lib/prisma";
import {
  filterFunRadarItems,
  filterGenericEdmItems,
  filterLabelRadarItems,
  filterYouTubeItems,
} from "@/lib/source-filters";
import { SourceType } from "@/lib/source-types";

async function fetchSourceItems(source: { type: string; feedUrl: string }) {
  if (source.type === SourceType.RA_NEWS_HTML) {
    return fetchRaNewsHtml(source.feedUrl);
  }

  if (source.type === SourceType.BEATPORTAL_HTML) {
    return fetchBeatportalHtml(source.feedUrl);
  }

  if (source.type === SourceType.INSTAGRAM_HASHTAG) {
    return fetchInstagramHashtagRadar(source.feedUrl);
  }

  const feed = await fetchFeed(source.feedUrl);

  if (source.type === SourceType.GENERIC_EDM_RSS) {
    const items = filterGenericEdmItems(feed.items);
    return {
      ...feed,
      items,
      message: `泛 EDM 过滤：${feed.items.length} 条中保留 ${items.length} 条 Trance 相关线索。`,
    };
  }

  if (source.type === SourceType.LABEL_RADAR_RSS) {
    const items = filterLabelRadarItems(feed.items);
    return {
      ...feed,
      items,
      message: `口碑厂牌过滤：${feed.items.length} 条中保留 ${items.length} 条厂牌/幕后/经典线索。`,
    };
  }

  if (source.type === SourceType.FUN_RADAR_RSS) {
    const items = filterFunRadarItems(feed.items);
    return {
      ...feed,
      items,
      message: `趣闻过滤：${feed.items.length} 条中保留 ${items.length} 条人物/争议/幕后线索。`,
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

  return feed;
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
