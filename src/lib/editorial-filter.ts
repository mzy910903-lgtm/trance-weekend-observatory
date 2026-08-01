type Candidate = {
  title: string | null;
  url: string;
  rawExcerpt: string | null;
  note: string | null;
  publishedAt?: Date | null;
  source?: { name: string; type?: string } | null;
};

export type EditorialDecision = {
  accepted: boolean;
  score: number;
  reason: string;
  scope: import("@/lib/trance-relevance").EditorialScope;
};

import { classifyTranceScope } from "@/lib/trance-relevance";

const lowSignalPatterns = [
  /\bweekly\b/i,
  /\bweek\s+\d{1,2}\b/i,
  /\bmixes?\b/i,
  /\bmixtapes?\b/i,
  /\bplaylists?\b/i,
  /\btop\s+(tracks?|releases?|songs?)\b/i,
  /\bround[\s-]?up\b/i,
  /\bchart\b/i,
  /\bepisode\s+\d+\b/i,
  /\bradio\s+show\b/i,
  /\bpodcast\b/i,
  /\blisten\s+now\b/i,
  /\blisten\b$/i,
  /\bout\s+now\b/i,
  /\bavailable\s+now\b/i,
  /\bpremiere\b/i,
  /每周|周更|歌单|榜单|混音集|节目单|电台节目/,
];

const communitySignalSourcePatterns = [
  /trancefix/i,
  /forum/i,
  /community/i,
];

const ordinaryReleaseTitlePatterns = [
  /^[^-|\n]{2,90}\s+-\s+.{2,180}\s+\[[^\]]+\]\s*$/i,
  /\b(?:out|available)\s+now\b/i,
  /\b(?:listen|stream)\s+now\b/i,
  /\bnew\s+(?:single|track|remix|edit|bootleg)\b/i,
  /\b(?:official\s+)?(?:audio|visuali[sz]er)\b/i,
  /\b(?:club|extended|radio)\s+(?:mix|edit)\b/i,
  /\b(?:remix|rework|bootleg|edit)\s*\[[^\]]+\]\s*$/i,
  /\bep\s+(?:preview|sampler)\b/i,
  /\bpreview\b/i,
  /\btba\b/i,
  /普通发歌|新歌发布|单曲发布|混音版发布|试听|预览/,
];

const dramaticPatterns = [
  /\bconfirm(?:s|ed)?\b/i,
  /\bunveil(?:s|ed)?\b/i,
  /\breveal(?:s|ed)?\b/i,
  /\brelaunch(?:es|ed)?\b/i,
  /\breturn(?:s|ed)?\b/i,
  /\bcomeback\b/i,
  /\bheadline[sd]?\b/i,
  /\bexclusive\b/i,
  /\bnew era\b/i,
  /\bnew chapter\b/i,
  /\bconfirms? new\b/i,
  /\bshuts?\s+down\b/i,
  /\bclose[sd]?\b/i,
  /\bcancel(?:s|led)?\b/i,
  /\bacqui(?:re|res|red|sition)\b/i,
  /\bmerger\b/i,
  /\blegal\b/i,
  /\bban(?:s|ned)?\b/i,
  /\bdeath\b/i,
  /\bdies\b/i,
  /\bcontrovers(?:y|ial)\b/i,
  /\bbacklash\b/i,
  /\bcriticis(?:e|ed|es|ing)\b/i,
  /\bapolog(?:y|ise|ized|izes)\b/i,
  /\bstatement\b/i,
  /\brenames?\b/i,
  /\brebrand(?:s|ed)?\b/i,
  /\baccident\b/i,
  /\bincident\b/i,
  /\btechnical\s+issue\b/i,
  /\bstage\s+(?:problem|malfunction)\b/i,
  /\bclashes?\b/i,
  /\bversus\b/i,
  /\bunexpected\b/i,
  /\bsurprise\b/i,
  /\bviral\b/i,
  /\bcommunity\b/i,
  /\bforum\b/i,
  /\bfans?\s+(?:react|respond|debate)\b/i,
  /确认|回归|复出|重启|新篇章|独家|头牌|压轴|关闭|取消|收购|合并|争议|道歉|声明|改名|更名|事故|故障|翻车|反转|意外|惊喜|热议|爆火|社区|粉丝讨论|去世/,
];

const importancePatterns = [
  /\balbum\b/i,
  /\bstudio album\b/i,
  /\blabel\b/i,
  /\bfestival\b/i,
  /\btour\b/i,
  /\blineup\b/i,
  /\bopen air\b/i,
  /\banniversary\b/i,
  /\b\d{2}\s+years?\b/i,
  /\bafter\s+\d{2}\s+years?\b/i,
  /\bfirst\s+(?:original|new)\b/i,
  /\bclassic\b/i,
  /\bstate of trance\b/i,
  /\bdreamstate\b/i,
  /\banjunabeats\b/i,
  /\bblack hole\b/i,
  /\benhanced progressive\b/i,
  /专辑|厂牌|音乐节|巡演|阵容|周年|现场|里程碑/,
];

const interestingPatterns = [
  /\bcontrovers(?:y|ial)\b/i,
  /\bbacklash\b/i,
  /\bapolog(?:y|ise|ized|izes)\b/i,
  /\bstatement\b/i,
  /\brenames?\b/i,
  /\brebrand(?:s|ed)?\b/i,
  /\baccident\b/i,
  /\bincident\b/i,
  /\btechnical\s+issue\b/i,
  /\bunexpected\b/i,
  /\bsurprise\b/i,
  /\bafter\s+\d{2}\s+years?\b/i,
  /\bfirst\s+(?:original|new)\b/i,
  /\bclassic\b/i,
  /\bviral\b/i,
  /\bcommunity\b/i,
  /\bforum\b/i,
  /\bfans?\s+(?:react|respond|debate)\b/i,
  /争议|道歉|声明|改名|更名|事故|故障|翻车|反转|意外|惊喜|热议|爆火|社区|粉丝讨论/,
];

const ordinaryPromoPatterns = [
  /\bannounce[sd]?\b/i,
  /\blaunch(?:es|ed)?\b/i,
  /\brelease[sd]?\b/i,
  /\bdrop(?:s|ped)?\b/i,
  /\bnew\s+(?:single|track|release|remix)\b/i,
  /\blineup\b/i,
  /\btickets?\b/i,
  /宣布|发布|释出|新单曲|新歌|阵容公布|门票|售票/,
];

const majorArtistPatterns = [
  /\babove\s*&\s*beyond\b/i,
  /\barmin\s+van\s+buuren\b/i,
  /\bti[eë]sto\b/i,
  /\bpaul\s+van\s+dyk\b/i,
  /\bferry\s+corsten\b/i,
  /\bsolarstone\b/i,
  /\borkidea\b/i,
  /\bpush\b/i,
  /\bchicane\b/i,
  /\bdash\s+berlin\b/i,
];

const strongEventPatterns = [
  /\b(?:lawsuit|court|legal|ban|policy|platform)\b/i,
  /\b(?:statement|apolog(?:y|ise|ized|izes)|backlash|controvers(?:y|ial))\b/i,
  /\b(?:cancel(?:s|led)?|postpone[sd]?|shuts?\s+down|close[sd]?)\b/i,
  /\b(?:return(?:s|ed)?|comeback|relaunch(?:es|ed)?|rebrand(?:s|ed)?|renames?)\b/i,
  /\b(?:festival|tour|lineup|headline[sd]?|anniversary|album|label)\b/i,
  /\b(?:after\s+\d{2}\s+years?|first\s+(?:original|new)|classic)\b/i,
  /\b(?:incident|accident|malfunction|unexpected|surprise|viral)\b/i,
  /\b(?:fans?\s+(?:react|respond|debate)|community|forum)\b/i,
  /诉讼|法院|封禁|政策|平台|声明|道歉|争议|反弹|取消|延期|关闭|复出|回归|重启|改名|更名|音乐节|巡演|阵容|头牌|周年|专辑|厂牌|事故|故障|意外|惊喜|热议|社区|粉丝讨论/,
];

const reputationRadarPatterns = [
  /\bpure\s+trance\b/i,
  /\bblack\s+hole\b/i,
  /\banjuna(?:beats|deep)?\b/i,
  /\barmada\b/i,
  /\basot\b/i,
  /\ba\s+state\s+of\s+trance\b/i,
  /\bfsoe\b/i,
  /\bfuture\s+sound\s+of\s+egypt\b/i,
  /\benhanced\b/i,
  /\bperfecto\b/i,
  /\bvandit\b/i,
  /\bsubculture\b/i,
  /\bcoldharbour\b/i,
  /\bpure\s+progressive\b/i,
];

const evergreenStoryPatterns = [
  /\binterview\b/i,
  /\bdeep\s+dive\b/i,
  /\bmaking\s+of\b/i,
  /\bbehind\s+the\s+scenes\b/i,
  /\bspotlight\b/i,
  /\bclassic\b/i,
  /\banniversary\b/i,
  /\bcompilation\b/i,
  /\bnew\s+chapter\b/i,
  /\breturns?\b/i,
  /\bcomeback\b/i,
  /采访|幕后|深挖|专题|经典|周年|合辑|新篇章|回归|复出/,
];

const funStoryPatterns = [
  /\baccus(?:e|es|ed|ation)\b/i,
  /\bresponds?\b/i,
  /\bcontrovers(?:y|ial)\b/i,
  /\bbacklash\b/i,
  /\bincident\b/i,
  /\bunexpected\b/i,
  /\bweird\b/i,
  /\bsurprise\b/i,
  /\bsynth\b/i,
  /\bplugin\b/i,
  /\bstudio\b/i,
  /\bgear\b/i,
  /\blab\b/i,
  /\bproducer\b/i,
  /\bturns?\s+\d+\b/i,
  /\bpride\b/i,
  /\bculture\b/i,
  /\b(?:copyright|lawsuit|legal|court|policy|platform)\b/i,
  /\b(?:documentary|reissue|shutdown|acquir(?:e|ed|es)|obituary)\b/i,
  /\b(?:dies|death)\b/i,
  /争议|回应|指控|事故|意外|奇怪|惊喜|合成器|插件|设备|工作室|制作人|社区|文化/,
  /版权|诉讼|法律|平台|纪录片|再版|关闭|收购|去世/,
];

function normalizedText(candidate: Candidate) {
  return [
    candidate.title,
    candidate.source?.name,
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

function countMatches(patterns: RegExp[], text: string) {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function matchesAny(patterns: RegExp[], text: string) {
  return patterns.some((pattern) => pattern.test(text));
}

export function judgeAutoDraftCandidate(candidate: Candidate): EditorialDecision {
  const text = normalizedText(candidate);
  const titleText = candidate.title ?? "";
  const scope = classifyTranceScope(candidate);
  const lowSignal = countMatches(lowSignalPatterns, text);
  const drama = countMatches(dramaticPatterns, text);
  const interesting = countMatches(interestingPatterns, text);
  const importance = countMatches(importancePatterns, text);
  const majorArtist = countMatches(majorArtistPatterns, text);
  const ordinaryPromo = countMatches(ordinaryPromoPatterns, text);
  const strongEvent = countMatches(strongEventPatterns, text);
  const ordinaryRelease =
    matchesAny(ordinaryReleaseTitlePatterns, titleText) ||
    matchesAny(ordinaryReleaseTitlePatterns, text);
  const communitySignalSource = matchesAny(
    communitySignalSourcePatterns,
    candidate.source?.name ?? "",
  );
  const sourceType = candidate.source?.type ?? "";
  const reputationSignal = countMatches(reputationRadarPatterns, text);
  const evergreenStory = countMatches(evergreenStoryPatterns, text);
  const funStory = countMatches(funStoryPatterns, text);
  const supplementalSource =
    sourceType === "LABEL_RADAR_RSS" || sourceType === "FUN_RADAR_RSS";
  const missingPublishedAtPenalty = candidate.publishedAt ? 0 : 2;
  const ordinaryPenalty =
    ordinaryRelease && strongEvent === 0 && importance < 2
      ? 8
      : ordinaryRelease
        ? 2
        : 0;
  const promoPenalty =
    strongEvent > 0 || importance >= 2 ? ordinaryPromo : ordinaryPromo * 2;
  const score =
    drama * 4 +
    interesting * 3 +
    importance * 3 +
    strongEvent * 3 +
    majorArtist * 3 +
    reputationSignal * 2 +
    evergreenStory * 2 +
    funStory * 2 -
    lowSignal * 4 -
    promoPenalty -
    ordinaryPenalty -
    (communitySignalSource ? 3 : 0) -
    missingPublishedAtPenalty;

  if (scope === "OFF_TOPIC") {
    return {
      accepted: false,
      score,
      scope,
      reason: "自动草稿跳过：非传思主题，泛 EDM / 硬件 / 无关现场不进入候选池。",
    };
  }

  if (ordinaryRelease && strongEvent === 0 && importance < 2) {
    return {
      accepted: false,
      score,
      scope,
      reason: "自动草稿跳过：普通发歌/Remix/EP 预览，不进入资讯及趣闻候选池。",
    };
  }

  if (scope === "CONTEXT") {
    if (lowSignal > 0 || ordinaryPromo > 0 || funStory === 0 || score < 2) {
      return {
        accepted: false,
        score,
        scope,
        reason: "自动草稿跳过：相邻电子乐内容缺少明确传思编辑价值。",
      };
    }

    return {
      accepted: true,
      score,
      scope,
      reason: `通过相邻趣闻筛选：有明确电子乐文化关联，综合分 ${score}。`,
    };
  }

  if (
    supplementalSource &&
    lowSignal === 0 &&
    (reputationSignal > 0 || evergreenStory > 0 || funStory > 0) &&
    score >= 3
  ) {
    return {
      accepted: true,
      score,
      scope,
      reason: `通过补位候选筛选：口碑/趣闻信号 ${reputationSignal + evergreenStory + funStory}，综合分 ${score}。`,
    };
  }

  if (communitySignalSource && strongEvent < 2 && drama === 0) {
    return {
      accepted: false,
      score,
      scope,
      reason: "自动草稿跳过：社区线索源仅保留强事件，普通发歌帖先挡在候选池外。",
    };
  }

  if (lowSignal > 0 && drama === 0 && majorArtist === 0) {
    return {
      accepted: false,
      score,
      scope,
      reason: "自动草稿跳过：新闻性/趣味性不足，命中周更、mix、歌单或榜单类低信号内容。",
    };
  }

  if (ordinaryPromo > 0 && drama === 0 && majorArtist === 0 && importance < 2) {
    return {
      accepted: false,
      score,
      scope,
      reason: "自动草稿跳过：普通发布/官宣/阵容稿，缺少争议、反转、社区热议或明确重要性。",
    };
  }

  if (drama === 0 && interesting === 0 && importance < 2 && strongEvent === 0) {
    return {
      accepted: false,
      score,
      scope,
      reason: "自动草稿跳过：低新闻性，缺少事件、趣闻、社区讨论或明确场景影响。",
    };
  }

  if (score < 5) {
    return {
      accepted: false,
      score,
      scope,
      reason: "自动草稿跳过：新鲜度通过，但事件性/趣味性分数不足。",
    };
  }

  return {
    accepted: true,
    score,
    scope,
    reason: `通过自动草稿筛选：新鲜度通过，事件性 ${drama}、重要性 ${importance}、趣味/社区信号 ${interesting}、强事件信号 ${strongEvent}，综合分 ${score}。`,
  };
}
