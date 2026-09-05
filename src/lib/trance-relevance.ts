import { isProgressiveDepth } from "@/lib/progressive-depth";

export type EditorialScope = "CORE" | "CONTEXT" | "OFF_TOPIC";

type RelevanceCandidate = {
  title: string | null;
  url: string;
  rawExcerpt?: string | null;
  note?: string | null;
  source?: { name: string; type?: string } | null;
};

const coreTrancePatterns = [
  /\btrance\b/i,
  /\bprogressive\s+trance\b/i,
  /\buplifting\b/i,
  /\btech\s+trance\b/i,
  /\bpsy(?:chedelic)?\s*trance\b/i,
  /\ba\s+state\s+of\s+trance\b/i,
  /\basot\b/i,
  /\bdreamstate\b/i,
  /\banjuna(?:beats|deep)?\b/i,
  /\barmada\b/i,
  /\bpure\s+trance\b/i,
  /\bblack\s+hole\b/i,
  /\bfsoe\b/i,
  /\bfuture\s+sound\s+of\s+egypt\b/i,
  /\benhanced(?:\s+progressive)?\b/i,
  /\bsubculture\b/i,
  /\bcoldharbour\b/i,
  /\bperfecto\b/i,
  /\bvandit\b/i,
  /\babove\s*&\s*beyond\b/i,
  /\barmin\s+van\s+buuren\b/i,
  /\bpaul\s+van\s+dyk\b/i,
  /\bferry\s+corsten\b/i,
  /\bsolarstone\b/i,
  /\bdash\s+berlin\b/i,
  /\baly\s*&\s*fila\b/i,
  /\bgiuseppe\s+ottaviani\b/i,
  /\bjohn\s+o['’]callaghan\b/i,
  /\bbryan\s+kearney\b/i,
  /\bcosmic\s+gate\b/i,
  /\borkidea\b/i,
  /\bchicane\b/i,
  /\bpaul\s+oakenfold\b/i,
  /\bti[eë]sto\b/i,
];

const trustedCoreSourcePatterns = [
  /trancefix/i,
  /trance\s+news/i,
  /trance\s+radar/i,
  /pure\s+trance/i,
  /a\s+state\s+of\s+trance/i,
  /above\s*&\s*beyond/i,
  /anjuna/i,
  /armada/i,
  /black\s+hole/i,
  /dreamstate/i,
  /future\s+sound\s+of\s+egypt/i,
  /trancentral/i,
  /oz\s+edm\s+trance/i,
];

const adjacentCulturePeoplePatterns = [
  /\bvangelis\b/i,
  /\bjean-michel\s+jarre\b/i,
  /\btom\s+oberheim\b/i,
  /\bkraftwerk\b/i,
  /\bunderworld\b/i,
  /\borbital\b/i,
  /\bthe\s+orb\b/i,
  /\bthe\s+prodigy\b/i,
  /\bchemical\s+brothers\b/i,
  /\b808\s+state\b/i,
  /\bdaft\s+punk\b/i,
  /\bmoby\b/i,
  /\bkavinsky\b/i,
  /\baphex\s+twin\b/i,
  /\bpatrick\s+gleeson\b/i,
];

const adjacentCultureStoryPatterns = [
  /\bcs-80\b/i,
  /\bmidi\b/i,
  /\bsynth(?:esizer)?s?\b/i,
  /\banalog(?:ue)?\b/i,
  /\bstudio\b/i,
  /\bproduction\b/i,
  /\blegacy\b/i,
  /\bhistory\b/i,
  /\bclassic\b/i,
  /\binterview\b/i,
  /\bretrospective\b/i,
  /\bdocumentary\b/i,
  /\bexhibition\b/i,
  /\barchive\b/i,
  /\banniversary\b/i,
  /\breissue\b/i,
  /\brave\s+culture\b/i,
  /\bclub\s+culture\b/i,
  /合成器|模拟|制作史|工作室|经典|遗产|历史/,
];

const adjacentIndustryStoryPatterns = [
  /\b(?:copyright|lawsuit|legal|court|policy|platform)\b/i,
  /\b(?:documentary|rave\s+culture|club\s+culture|love\s+parade)\b/i,
  /\b(?:acquire[sd]?|shutdown|shuts?\s+down|reissue|obituary|dies|death)\b/i,
  /版权|诉讼|法律|平台|纪录片|锐舞文化|爱心大游行|收购|关闭|再版|去世/,
];

const adjacentIndustryRejectPatterns = [
  /\b(?:review|versus|best\s+new|plugins?|monitor|headphones?)\b/i,
  /\b(?:single|track|remix|out\s+now|listen\s+now)\b/i,
  /评测|插件|监听|耳机|单曲|混音|新歌发布/,
];

function matchesAny(patterns: RegExp[], value: string) {
  return patterns.some((pattern) => pattern.test(value));
}

function normalizedText(candidate: RelevanceCandidate, includeSource = true) {
  return [
    candidate.title,
    includeSource ? candidate.source?.name : null,
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

function isTrustedCoreSource(candidate: RelevanceCandidate) {
  const type = candidate.source?.type ?? "";
  const sourceName = candidate.source?.name ?? "";

  if (type === "RA_NEWS_HTML" || type === "LABEL_RADAR_RSS") {
    return true;
  }

  if (type === "FUN_RADAR_RSS" || type === "GENERIC_EDM_RSS") {
    return false;
  }

  return matchesAny(trustedCoreSourcePatterns, sourceName);
}

export function classifyTranceScope(candidate: RelevanceCandidate): EditorialScope {
  const content = normalizedText(candidate, false);

  if (
    matchesAny(coreTrancePatterns, content) ||
    isProgressiveDepth(candidate) ||
    isTrustedCoreSource(candidate)
  ) {
    return "CORE";
  }

  if (
    matchesAny(adjacentCulturePeoplePatterns, content) &&
    matchesAny(adjacentCultureStoryPatterns, content)
  ) {
    return "CONTEXT";
  }

  const sourceType = candidate.source?.type ?? "";
  if (
    sourceType === "FUN_RADAR_RSS" &&
    matchesAny(adjacentIndustryStoryPatterns, content) &&
    !matchesAny(adjacentIndustryRejectPatterns, content)
  ) {
    return "CONTEXT";
  }

  return "OFF_TOPIC";
}

export function editorialScopeLabel(scope: EditorialScope) {
  if (scope === "CORE") return "传思主线";
  if (scope === "CONTEXT") return "相邻趣闻";
  return "非传思主题";
}
