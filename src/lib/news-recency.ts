const DEFAULT_MAX_SOURCE_AGE_DAYS = 7;
const MAX_CONFIGURABLE_SOURCE_AGE_DAYS = 365;

export type NewsRecencyCandidate = {
  title: string | null;
  url: string;
  rawExcerpt?: string | null;
  note?: string | null;
  publishedAt?: Date | null;
  discoveredAt?: Date | null;
};

export type NewsRecencyDecision = {
  accepted: boolean;
  reason: string;
  maxAgeDays: number;
  ageDays?: number;
};

export function parseMaxSourceAgeDays() {
  const value = Number.parseInt(process.env.AUTO_DRAFT_MAX_SOURCE_AGE_DAYS ?? "", 10);
  if (Number.isNaN(value)) return DEFAULT_MAX_SOURCE_AGE_DAYS;
  return Math.min(Math.max(value, 1), MAX_CONFIGURABLE_SOURCE_AGE_DAYS);
}

function daysBetween(later: Date, earlier: Date) {
  return Math.floor((later.getTime() - earlier.getTime()) / (24 * 60 * 60 * 1000));
}

function normalizedText(candidate: NewsRecencyCandidate) {
  return [
    candidate.title,
    candidate.rawExcerpt,
    candidate.note,
    candidate.url,
  ]
    .filter(Boolean)
    .join("\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractYears(text: string) {
  return Array.from(text.matchAll(/\b(20\d{2})\b/g))
    .map((match) => Number.parseInt(match[1] ?? "", 10))
    .filter((year) => Number.isInteger(year));
}

function isClearlyArchivedByYear(candidate: NewsRecencyCandidate, now: Date) {
  const text = normalizedText(candidate);
  const years = extractYears(text);
  if (years.length === 0) return null;

  const currentYear = now.getFullYear();
  const maxMentionedYear = Math.max(...years);

  if (maxMentionedYear < currentYear) {
    return `自动草稿跳过：内容指向 ${maxMentionedYear} 年，明显不是当前新闻。`;
  }

  return null;
}

export function judgeNewsRecency(
  candidate: NewsRecencyCandidate,
  now = new Date(),
  maxAgeDays = parseMaxSourceAgeDays(),
): NewsRecencyDecision {
  if (candidate.publishedAt) {
    const ageDays = daysBetween(now, candidate.publishedAt);

    if (ageDays > maxAgeDays) {
      return {
        accepted: false,
        reason: `自动草稿跳过：原文发布于 ${candidate.publishedAt.toISOString().slice(0, 10)}，已超过 ${maxAgeDays} 天时效窗口。`,
        maxAgeDays,
        ageDays,
      };
    }
  }

  const archivedByYear = isClearlyArchivedByYear(candidate, now);
  if (archivedByYear) {
    return {
      accepted: false,
      reason: archivedByYear,
      maxAgeDays,
    };
  }

  if (!candidate.publishedAt) {
    return {
      accepted: true,
      reason: `通过时效筛选：来源缺少发布时间，进入低优先级候选并等待抓取复核。`,
      maxAgeDays,
    };
  }

  return {
    accepted: true,
    reason: `通过时效筛选：未超过 ${maxAgeDays} 天新闻窗口。`,
    maxAgeDays,
  };
}
