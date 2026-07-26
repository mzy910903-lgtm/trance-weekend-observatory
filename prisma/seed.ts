import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const samples = [
  {
    title: "Above & Beyond 公布新一轮 Group Therapy 现场计划",
    slug: "above-beyond-group-therapy-live-plan",
    category: "LIVE",
    sourceName: "Anjunabeats",
    sourceUrl: "https://www.anjunabeats.com/",
    coverImage: "/default-cover.svg",
    publishedAt: new Date("2026-06-20T10:00:00.000Z"),
    summary:
      "Anjunabeats 释出 Group Therapy 相关现场动态，暗示新阶段演出将继续围绕情绪型旋律、社群共振与大型视觉系统展开。",
    fullSummary:
      "这条资讯适合作为现场栏目入口：它不全文转载来源内容，只提炼 Group Therapy 现场计划的公开要点，并保留读者跳转原文的路径。对于 Trance Weekend 来说，重点不只是巡演信息，而是大型 Progressive Trance 叙事如何继续影响现场文化。",
    importanceScore: 8,
    artistryScore: 7,
    humorScore: 3,
    scoreExplanation:
      "重要性较高，因为 Group Therapy 仍是当代 Progressive Trance 社群的核心现场品牌；艺术性来自旋律和视觉叙事；幽默性较低，主要是正式资讯。",
    aiComment: "传思浓度稳定上升，适合把心率交给四拍底鼓托管。",
    tags: ["Progressive Trance", "Anjunabeats", "现场"],
  },
  {
    title: "一支 Uplifting 新曲在论坛引发老派旋律党集合",
    slug: "uplifting-track-melody-forum-reaction",
    category: "TRACK",
    sourceName: "Community Radar",
    sourceUrl: "https://example.com/uplifting-track",
    coverImage: "/default-cover.svg",
    publishedAt: new Date("2026-06-18T08:30:00.000Z"),
    summary:
      "一首偏 138 BPM 的 Uplifting Trance 新曲因主旋律写法复古，在爱好者讨论区获得集中关注。",
    fullSummary:
      "样例资讯展示了新歌条目的基本形态：短摘要、来源链接、标签与三维评分。正文只做概述，不复制原文细节，方便管理员后续替换成真实抓取内容。",
    importanceScore: 6,
    artistryScore: 8,
    humorScore: 5,
    scoreExplanation:
      "重要性中等，属于社区热度型内容；艺术性较高，旋律写法是核心；幽默性来自评论区对老派 Drop 的集体怀旧。",
    aiComment: "一按下播放键，2009 年的合成器阳光就从耳机缝里漏出来了。",
    tags: ["Uplifting Trance", "新歌", "社区"],
  },
  {
    title: "Psy Trance 梗图再次证明低频比会议纪要更有执行力",
    slug: "psy-trance-meme-low-end-meeting-notes",
    category: "MEME",
    sourceName: "Meme Desk",
    sourceUrl: "https://example.com/psy-meme",
    coverImage: "/default-cover.svg",
    publishedAt: new Date("2026-06-15T12:00:00.000Z"),
    summary:
      "一组 Psy Trance 场景梗图在社交平台传播，主题围绕低频、视觉幻觉与凌晨三点仍不下班的贝斯线。",
    fullSummary:
      "该样例用于验证「梗」分类页面和幽默性评分。它保留来源链接，不复制图片正文，只展示简短概述与 AI 风格点评。",
    importanceScore: 4,
    artistryScore: 6,
    humorScore: 9,
    scoreExplanation:
      "重要性不高但社区辨识度强；艺术性来自亚文化视觉语言；幽默性突出，适合轻量传播。",
    aiComment: "这不是梗图，这是凌晨三点低频部门发来的绩效报告。",
    tags: ["Psy Trance", "梗", "低频"],
  },
];

async function main() {
  for (const item of samples) {
    const source = await prisma.source.upsert({
      where: { url: item.sourceUrl },
      update: { name: item.sourceName },
      create: { name: item.sourceName, url: item.sourceUrl },
    });

    const article = await prisma.article.upsert({
      where: { slug: item.slug },
      update: {},
      create: {
        slug: item.slug,
        title: item.title,
        summary: item.summary,
        fullSummary: item.fullSummary,
        coverImage: item.coverImage,
        sourceName: item.sourceName,
        sourceUrl: item.sourceUrl,
        sourceId: source.id,
        publishedAt: item.publishedAt,
        category: item.category,
        status: "PUBLISHED",
        importanceScore: item.importanceScore,
        artistryScore: item.artistryScore,
        humorScore: item.humorScore,
        scoreExplanation: item.scoreExplanation,
        aiComment: item.aiComment,
      },
    });

    for (const tagName of item.tags) {
      const tag = await prisma.tag.upsert({
        where: { slug: tagName.toLowerCase().replace(/\s+/g, "-") },
        update: {},
        create: {
          name: tagName,
          slug: tagName.toLowerCase().replace(/\s+/g, "-"),
        },
      });

      await prisma.articleTag.upsert({
        where: { articleId_tagId: { articleId: article.id, tagId: tag.id } },
        update: {},
        create: { articleId: article.id, tagId: tag.id },
      });
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
