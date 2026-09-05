type Candidate = {
  title: string | null;
  rawExcerpt?: string | null;
};

export function isProgressiveDepth(candidate: Candidate) {
  const title = candidate.title ?? "";
  const text = `${title}\n${candidate.rawExcerpt ?? ""}`;
  const topic = /\b(?:progressive[ -]house|john digweed|hern[aá]n catt[aá]neo|guy j|nick warren|dave seaman|anthony pappa|sudbeat|bedrock|global underground|the soundgarden|lost & found|balance music|sound avenue|3rd avenue|future avenue|mango alley|meanwhile|selador|replug|movement recordings|juicebox|cid inc|dmitry molosh|guy mantzur|ezequiel arias|gai barone|danny howells|quivver|luke chable|kamilo sanclemente|mike rish|g\.?m\.?j\.?)\b/i.test(text)
    || (/\bsasha\b/i.test(text) && /\b(?:dj|producer|club|mixing)\b/i.test(text));
  const feature = /\b(?:interview|in conversation|we caught up|deep dive|behind the scenes|making of|oral history|documentary|label of the month|emerging artist series|artist series|creative process|reflects? on|career journey|debut album)\b|采访|访谈|口述史|幕后|创作过程|厂牌专题/i.test(text);
  const purePromo = /\b(?:premiere|out now|listen now|playlist|weekly|podcast|chart)\b/i.test(title)
    && !/\b(?:interview|in conversation)\b/i.test(title);
  return topic && feature && !purePromo;
}
