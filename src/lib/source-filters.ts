import type { FeedItem } from "@/lib/feeds";

const tranceSignalPatterns = [
  /trance/i,
  /progressive/i,
  /uplifting/i,
  /psy(?:chedelic)?\s*trance/i,
  /anjuna(?:beats|deep)?/i,
  /above\s*&\s*beyond/i,
  /group\s+therapy/i,
  /armada/i,
  /a\s+state\s+of\s+trance/i,
  /\basot\b/i,
  /dreamstate/i,
  /black\s+hole/i,
  /fsoe/i,
  /future\s+sound\s+of\s+egypt/i,
  /enhanced/i,
  /pure\s+trance/i,
  /armin\s+van\s+buuren/i,
  /paul\s+van\s+dyk/i,
  /ferry\s+corsten/i,
  /solarstone/i,
  /dash\s+berlin/i,
  /aly\s*&\s*fila/i,
  /giuseppe\s+ottaviani/i,
  /john\s+o'callaghan/i,
  /bryan\s+kearney/i,
  /cosmic\s+gate/i,
  /orkidea/i,
  /chicane/i,
  /ti[eë]sto/i,
];

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
  /synth|plugin|studio|gear|lab/i,
  /birthday|turns?\s+\d+/i,
  /pride|community|culture/i,
  /review/i,
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

export function isTranceRelevantItem(item: FeedItem) {
  const text = itemText(item);
  return tranceSignalPatterns.some((pattern) => pattern.test(text));
}

export function isSocialNewsItem(item: FeedItem) {
  const text = itemText(item);
  return socialNewsPatterns.some((pattern) => pattern.test(text));
}

export function filterGenericEdmItems(items: FeedItem[]) {
  return items.filter(isTranceRelevantItem);
}

export function filterLabelRadarItems(items: FeedItem[]) {
  return items.filter((item) => {
    const text = itemText(item);
    if (lowSignalVideoPatterns.some((pattern) => pattern.test(text))) {
      return false;
    }
    return (
      labelRadarPatterns.some((pattern) => pattern.test(text)) &&
      (featureRadarPatterns.some((pattern) => pattern.test(text)) ||
        isSocialNewsItem(item))
    );
  });
}

export function filterFunRadarItems(items: FeedItem[]) {
  return items.filter((item) => {
    const text = itemText(item);
    if (lowSignalVideoPatterns.some((pattern) => pattern.test(text))) {
      return false;
    }
    return funRadarPatterns.some((pattern) => pattern.test(text));
  });
}

export function filterYouTubeItems(items: FeedItem[]) {
  return items.filter((item) => {
    const text = itemText(item);
    if (!isTranceRelevantItem(item)) return false;
    if (lowSignalVideoPatterns.some((pattern) => pattern.test(text))) {
      return false;
    }
    return isSocialNewsItem(item);
  });
}

export function filterInstagramItems(items: FeedItem[]) {
  return items.filter((item) => isTranceRelevantItem(item) && isSocialNewsItem(item));
}
