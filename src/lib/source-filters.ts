import type { FeedItem } from "@/lib/feeds";
import { isProgressiveDepth } from "@/lib/progressive-depth";
import { classifyTranceScope, type EditorialScope } from "@/lib/trance-relevance";

const socialNewsPatterns = [
  /announce[sd]?/i,
  /confirm(?:s|ed)?/i,
  /unveil(?:s|ed)?/i,
  /reveal(?:s|ed)?/i,
  /return(?:s|ed)?/i,
  /comeback/i,
  /cancel(?:s|led)?/i,
  /statement/i,
  /lineup/i,
  /tour/i,
  /festival/i,
  /album/i,
  /label/i,
  /controvers(?:y|ial)/i,
  /incident/i,
  /backlash/i,
  /rebrand(?:s|ed)?/i,
  /rename[sd]?/i,
  /surprise/i,
  /interview/i,
  /trailer/i,
  /aftermovie/i,
  /宣布|确认|公布|公开|回归|复出|取消|声明|阵容|巡演|音乐节|专辑|厂牌|争议|事故|热议|改名|更名|预告|访谈/,
];

const labelRadarPatterns = [
  /pure\s+trance/i,
  /black\s+hole/i,
  /anjuna(?:beats|deep)?/i,
  /armada/i,
  /\basot\b/i,
  /a\s+state\s+of\s+trance/i,
  /fsoe/i,
  /future\s+sound\s+of\s+egypt/i,
  /enhanced/i,
  /perfecto/i,
  /vandit/i,
  /subculture/i,
  /coldharbour/i,
  /pure\s+progressive/i,
  /solarstone/i,
  /orkidea/i,
  /paul\s+oakenfold/i,
  /paul\s+van\s+dyk/i,
];

const featureRadarPatterns = [
  /interview/i,
  /deep\s+dive/i,
  /behind\s+the\s+scenes/i,
  /making\s+of/i,
  /new\s+chapter/i,
  /story/i,
  /classic/i,
  /anniversary/i,
  /returns?/i,
  /comeback/i,
  /spotlight/i,
  /compilation/i,
  /album/i,
  /label/i,
  /厂牌|采访|幕后|深挖|故事|经典|周年|回归|复出|专题|专辑|合辑/,
];

const funRadarPatterns = [
  /accus(?:e|es|ed|ation)/i,
  /responds?/i,
  /controvers(?:y|ial)/i,
  /backlash/i,
  /lawsuit|legal|court/i,
  /incident|accident|malfunction/i,
  /unexpected|surprise|strange|weird/i,
  /interview/i,
  /producer/i,
  /synth|cs-80|plugin|studio|gear|lab/i,
  /birthday|turns?\s+\d+/i,
  /pride|community|culture/i,
  /review/i,
  /copyright|lawsuit|legal|court|policy|platform/i,
  /documentary|reissue|shutdown|acquire[sd]?|obituary|dies|death/i,
  /版权|诉讼|法律|平台|纪录片|再版|关闭|收购|去世/,
  /争议|回应|指控|法律|事故|故障|意外|惊喜|奇怪|采访|制作人|合成器|插件|设备|工作室|生日|社区|文化|现场回顾/,
];

const lowSignalVideoPatterns = [
  /full\s+set/i,
  /dj\s+set/i,
  /live\s+set/i,
  /weekly/i,
  /episode\s+\d+/i,
  /\bmix(?:es)?\b/i,
  /mixtape/i,
  /playlist/i,
  /visuali[sz]er/i,
  /official\s+(?:audio|video)/i,
  /lyrics?/i,
  /radio\s+show/i,
  /歌单|混音集|电台节目|可视化|歌词/,
];

function itemText(item: FeedItem) {
  return `${item.title}\n${item.url}\n${item.excerpt}`;
}

function scopeForItem(
  item: FeedItem,
  source?: { name: string; type?: string },
): EditorialScope {
  return classifyTranceScope({
    title: item.title,
    url: item.url,
    rawExcerpt: item.excerpt,
    source,
  });
}

export function isTranceRelevantItem(
  item: FeedItem,
  source?: { name: string; type?: string },
) {
  return scopeForItem(item, source) === "CORE";
}

export function isSocialNewsItem(item: FeedItem) {
  const text = itemText(item);
  return socialNewsPatterns.some((pattern) => pattern.test(text));
}

export function filterCoreTranceItems(
  items: FeedItem[],
  source?: { name: string; type?: string },
) {
  return items.filter((item) => scopeForItem(item, source) === "CORE");
}

export function filterGenericEdmItems(
  items: FeedItem[],
  source?: { name: string; type?: string },
) {
  return filterCoreTranceItems(items, source);
}

export function filterLabelRadarItems(
  items: FeedItem[],
  source?: { name: string; type?: string },
) {
  return items.filter((item) => {
    const text = `${source?.name ?? ""}\n${itemText(item)}`;
    if (lowSignalVideoPatterns.some((pattern) => pattern.test(text))) {
      return false;
    }
    return (
      scopeForItem(item, source) === "CORE" &&
      labelRadarPatterns.some((pattern) => pattern.test(text)) &&
      (featureRadarPatterns.some((pattern) => pattern.test(text)) ||
        isSocialNewsItem(item))
    );
  });
}

export function filterFunRadarItems(
  items: FeedItem[],
  source?: { name: string; type?: string },
) {
  return items.filter((item) => {
    const text = itemText(item);
    if (isProgressiveDepth({ title: item.title, rawExcerpt: item.excerpt })) return true;
    if (lowSignalVideoPatterns.some((pattern) => pattern.test(text))) {
      return false;
    }
    return (
      scopeForItem(item, source) !== "OFF_TOPIC" &&
      funRadarPatterns.some((pattern) => pattern.test(text))
    );
  });
}

export function filterYouTubeItems(
  items: FeedItem[],
  source?: { name: string; type?: string },
) {
  return items.filter((item) => {
    const text = itemText(item);
    if (!isTranceRelevantItem(item, source)) return false;
    if (lowSignalVideoPatterns.some((pattern) => pattern.test(text))) {
      return false;
    }
    return isSocialNewsItem(item);
  });
}

export function filterInstagramItems(
  items: FeedItem[],
  source?: { name: string; type?: string },
) {
  return items.filter(
    (item) => isTranceRelevantItem(item, source) && isSocialNewsItem(item),
  );
}
