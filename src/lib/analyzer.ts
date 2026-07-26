import OpenAI from "openai";
import { z } from "zod";
import { ArticleCategory } from "./categories";
import { slugify } from "./format";
import type { ScrapedPage } from "./scraper";

const analysisSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  fullSummary: z.string().min(1),
  tags: z.array(z.string()).min(2).max(8),
  category: z.enum([
    ArticleCategory.NEWS,
    ArticleCategory.TRACK,
    ArticleCategory.LABEL,
    ArticleCategory.LIVE,
    ArticleCategory.MEME,
    ArticleCategory.ARCHIVE,
  ]),
  importanceScore: z.number().int().min(1).max(10),
  artistryScore: z.number().int().min(1).max(10),
  humorScore: z.number().int().min(1).max(10),
  scoreExplanation: z.string().min(1),
  aiComment: z.string().min(1),
});

export type ArticleAnalysis = z.infer<typeof analysisSchema>;

function resolveAiConfig() {
  const provider = process.env.AI_PROVIDER?.toLowerCase() || "openai";
  const apiKey =
    process.env.AI_API_KEY ||
    (provider === "deepseek" ? process.env.DEEPSEEK_API_KEY : null) ||
    process.env.OPENAI_API_KEY;

  if (!apiKey) return null;

  if (provider === "deepseek") {
    return {
      apiKey,
      baseURL: process.env.AI_BASE_URL || "https://api.deepseek.com",
      model: process.env.AI_MODEL || "deepseek-v4-flash",
    };
  }

  return {
    apiKey,
    baseURL: process.env.AI_BASE_URL,
    model: process.env.AI_MODEL || "gpt-4o-mini",
  };
}

function parseJsonObject(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function inferCategory(text: string): ArticleCategory {
  const lower = text.toLowerCase();
  if (/meme|梗|funny|笑|段子/.test(lower)) return ArticleCategory.MEME;
  if (/label|厂牌|anjunabeats|armada|black hole/.test(lower)) return ArticleCategory.LABEL;
  if (/live|festival|club|现场|巡演|演出/.test(lower)) return ArticleCategory.LIVE;
  if (/new track|release|single|新歌|发行|remix/.test(lower)) return ArticleCategory.TRACK;
  if (/classic|archive|考古|回顾|anniversary/.test(lower)) return ArticleCategory.ARCHIVE;
  return ArticleCategory.NEWS;
}

function stripSourceSuffix(title: string) {
  return title
    .replace(/\s+\|\s+.*$/g, "")
    .replace(/\s+-\s+(OZ EDM|We Rave You|Trancentral).*$/i, "")
    .trim();
}

function localizeTitle(title: string) {
  const cleanTitle = stripSourceSuffix(title);
  const replacements: Array<[RegExp, string]> = [
    [/\bthis november\b/gi, "今年 11 月"],
    [/\baustralian\b/gi, "澳大利亚"],
    [/\baustralia\b/gi, "澳大利亚"],
    [/\bmelbourne\b/gi, "墨尔本"],
    [/\bsydney\b/gi, "悉尼"],
    [/\bbrisbane\b/gi, "布里斯班"],
    [/\blondon\b/gi, "伦敦"],
    [/\bamsterdam\b/gi, "阿姆斯特丹"],
    [/\bartist lineups?\b/gi, "艺人阵容"],
    [/\bannounce[sd]?\b/gi, "宣布"],
    [/\bunveil(?:s|ed)?\b/gi, "公布"],
    [/\breveal(?:s|ed)?\b/gi, "公开"],
    [/\brelease[sd]?\b/gi, "发布"],
    [/\bdrop(?:s|ped)?\b/gi, "释出"],
    [/\blaunch(?:es|ed)?\b/gi, "启动"],
    [/\brelaunch(?:es|ed)?\b/gi, "重启"],
    [/\breturn(?:s|ed)?\b/gi, "回归"],
    [/\bconfirm(?:s|ed)?\b/gi, "确认"],
    [/\bheadline[sd]?\b/gi, "担任头牌"],
    [/\bset to hit\b/gi, "即将登陆"],
    [/\blineup\b/gi, "阵容"],
    [/\bdates?\b/gi, "日期"],
    [/\bupcoming album\b/gi, "即将发行的专辑"],
    [/\bstudio album\b/gi, "录音室专辑"],
    [/\bnew single\b/gi, "新单曲"],
    [/\bnew era\b/gi, "新阶段"],
    [/\bnew chapter\b/gi, "新篇章"],
    [/\bfestival\b/gi, "音乐节"],
    [/\btour\b/gi, "巡演"],
    [/\bturns?\b/gi, "迎来"],
    [/\byears?\b/gi, "周年"],
    [/\bat\s+the\s+/gi, "于 "],
    [/\bat\s+/gi, "于 "],
    [/\bin\s+(\d{4})/gi, "于 $1 年"],
    [/\s+\+\s+/g, "，并"],
  ];

  const translated = replacements.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    cleanTitle,
  );

  const polished = translated
    .replace(/\s+(宣布|公布|公开|发布|释出|启动|重启|回归|确认|担任头牌)/g, "$1")
    .replace(/(宣布|公布|公开|发布|释出|启动|重启|确认)\s+/g, "$1")
    .replace(/\s+(音乐节|巡演|阵容|日期|新单曲|新阶段|新篇章|周年)/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

  return polished === cleanTitle ? `Trance 动态：${cleanTitle}` : polished;
}

function localizeSummary(page: ScrapedPage, category: ArticleCategory) {
  const title = localizeTitle(page.title);
  const source = page.siteName || "公开来源";
  const categoryLabel = {
    [ArticleCategory.NEWS]: "场景消息",
    [ArticleCategory.TRACK]: "发行动态",
    [ArticleCategory.LABEL]: "厂牌动态",
    [ArticleCategory.LIVE]: "现场动态",
    [ArticleCategory.MEME]: "社区梗图",
    [ArticleCategory.ARCHIVE]: "考古线索",
  }[category];

  if (page.scrapeStatus === "PARTIAL") {
    return `据 ${source} 的公开页面，${title}。片段不够厚，观察局先把它放上监听位，发布前还需要管理员回原文核一下。`;
  }

  return `据 ${source} 的公开页面，${title}。这条${categoryLabel}已经进入传思雷达：有来源、有短片段，等管理员判断它够不够上主舞台。`;
}

function fallbackAnalyze(page: ScrapedPage): ArticleAnalysis {
  const text = `${page.title}\n${page.description}\n${page.excerpt}`;
  const category = inferCategory(text);
  const sourceTag = page.siteName.length <= 40 ? page.siteName : null;
  const tags = [
    /psy/i.test(text) ? "Psy Trance" : null,
    /uplifting|138/i.test(text) ? "Uplifting Trance" : null,
    /progressive/i.test(text) ? "Progressive House" : null,
    /tech/i.test(text) ? "Tech Trance" : null,
    "Trance",
    sourceTag,
  ]
    .filter((tag): tag is string => Boolean(tag))
    .filter((tag) => tag.length <= 40) as string[];

  const title = localizeTitle(page.title);
  const summary = localizeSummary(page, category);

  return {
    title,
    summary: summary.slice(0, 180),
    fullSummary:
      `${summary}\n\n原文信息来自 ${page.siteName || "公开来源"}，本站仅保留短摘要、评分和编辑点评，不全文转载。发布前请管理员核对来源链接、主图、标签和评分。`.slice(
        0,
        600,
      ),
    tags: Array.from(new Set(tags)).slice(0, 6),
    category,
    importanceScore: category === ArticleCategory.NEWS ? 7 : 6,
    artistryScore: /trance|progressive|uplifting|psy|tech/i.test(text) ? 7 : 5,
    humorScore: category === ArticleCategory.MEME ? 8 : 3,
    scoreExplanation:
      page.scrapeStatus === "PARTIAL"
        ? "编辑部判词：片段偏薄，新鲜度和事件性需要人工回源确认，评分先保守处理。"
        : "编辑部判词：根据标题、描述和短片段判断事件性、音乐相关度与可讨论程度，发布前仍需人工把关。",
    aiComment: "低频信号已进站，够不够炸还得看管理员这一拍。",
  };
}

export async function analyzeArticle(page: ScrapedPage): Promise<ArticleAnalysis> {
  const aiConfig = resolveAiConfig();

  if (!aiConfig) {
    return fallbackAnalyze(page);
  }

  const openai = new OpenAI({
    apiKey: aiConfig.apiKey,
    baseURL: aiConfig.baseURL,
  });
  const completion = await openai.chat.completions.create({
    model: aiConfig.model,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "你是 Trance Weekend「传思宇宙观察局」的中文资讯编辑，口吻像地下电子乐编辑部：准确、短促、有一点幽默和现场感。只基于用户给出的结构化公开网页抓取结果生成中文转译、短摘要和编辑部判词，不全文转载，不输出原文长段落，不补造事实，不把普通通稿或普通发歌帖夸成重大事件。如果只是单曲/remix/EP 上架，必须写得克制，并在判词里指出新闻性有限。必须只输出 JSON object。",
      },
      {
        role: "user",
        content: JSON.stringify({
          instruction:
            "固定输出字段：title, summary, fullSummary, tags, category, importanceScore, artistryScore, humorScore, scoreExplanation, aiComment。title 必须是中文转译标题，不要直接照搬英文原标题；允许做轻度栏目化改写，让标题有钩子，但不能新增原文没有的事实；艺人名、厂牌名、曲名可保留英文原名。summary 用中文短摘要，控制在 180 字以内，写清楚发生了什么、为什么值得看；fullSummary 用中文概述，控制在 600 字以内；tags 为 2-8 个标签；category 只能是 NEWS/TRACK/LABEL/LIVE/MEME/ARCHIVE。三个评分为 1-10 整数：importanceScore 看场景影响，artistryScore 看音乐/厂牌/现场审美价值，humorScore 看怪味、反差、社区讨论和可吐槽程度。scoreExplanation 写成编辑部判词，说明新鲜度、事件性和趣味性；aiComment 是一句简短中文传思味儿点评，可以轻微幽默、地下、像栏目短评，但不得造谣、不得嘲讽私人灾难。不得复制原文长段落。不要把普通单曲、remix、EP preview 包装成重大新闻；如果 excerpt 不足或 scrapeStatus 是 PARTIAL，需要在摘要中保持保守，避免确定性表达。",
          page: {
            sourceTitle: page.title,
            sourceDescription: page.description,
            sourceExcerpt: page.excerpt,
            sourceSiteName: page.siteName,
            sourceUrl: page.canonicalUrl || page.url,
            sourceAuthor: page.author,
            sourcePublishedAt: page.publishedAt,
            scrapeStatus: page.scrapeStatus,
            scrapeMessage: page.scrapeMessage,
          },
        }),
      },
    ],
  });

  const content = completion.choices[0]?.message.content;
  if (!content) return fallbackAnalyze(page);

  const parsedJson = parseJsonObject(content);
  if (!parsedJson) return fallbackAnalyze(page);

  const parsed = analysisSchema.safeParse(parsedJson);
  if (!parsed.success) return fallbackAnalyze(page);

  return parsed.data;
}

export function makeArticleSlug(title: string) {
  const base = slugify(title) || "trance-signal";
  return `${base}-${Date.now().toString(36)}`;
}
