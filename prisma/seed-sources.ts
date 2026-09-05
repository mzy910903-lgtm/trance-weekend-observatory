import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const defaultSources = [
  {
    name: "Progressive Astronaut Interviews",
    url: "https://progressiveastronaut.com/category/interviews/",
    feedUrl: "https://progressiveastronaut.com/category/interviews/feed/",
    type: "PROGRESSIVE_DEPTH_RSS",
  },
  {
    name: "Decoded Magazine Interviews",
    url: "https://www.decodedmagazine.com/category/news/interviews/",
    feedUrl: "https://www.decodedmagazine.com/category/news/interviews/feed/",
    type: "PROGRESSIVE_DEPTH_RSS",
  },
  {
    name: "Electronic Groove Interviews & Features",
    url: "https://electronicgroove.com/category/interviews-features/",
    feedUrl: "https://electronicgroove.com/category/interviews-features/feed/",
    type: "PROGRESSIVE_DEPTH_RSS",
  },
  {
    name: "Sound Avenue Labelgroup",
    url: "https://soundavenue.substack.com/",
    feedUrl: "https://soundavenue.substack.com/feed",
    type: "PROGRESSIVE_DEPTH_RSS",
  },
  {
    name: "A State of Trance Label Radar",
    url: "https://www.astateoftrance.com",
    feedUrl: "https://www.astateoftrance.com/feed/",
    type: "LABEL_RADAR_RSS",
  },
  {
    name: "Beatportal",
    url: "https://www.beatportal.com/",
    feedUrl: "https://www.beatportal.com/",
    type: "BEATPORTAL_HTML",
  },
  {
    name: "Dancing Astronaut Radar",
    url: "https://dancingastronaut.com/",
    feedUrl: "https://dancingastronaut.com/feed/",
    type: "GENERIC_EDM_RSS",
  },
  {
    name: "EDMTunes Radar",
    url: "https://www.edmtunes.com/",
    feedUrl: "https://www.edmtunes.com/feed/",
    type: "GENERIC_EDM_RSS",
  },
  {
    name: "Electronic Groove",
    url: "https://electronicgroove.com",
    feedUrl: "https://electronicgroove.com/feed/",
    type: "FUN_RADAR_RSS",
  },
  {
    name: "MusicTech Fun Radar",
    url: "https://www.musictech.com",
    feedUrl: "https://www.musictech.com/feed/",
    type: "FUN_RADAR_RSS",
  },
  {
    name: "Pure Trance",
    url: "https://puretrance.com",
    feedUrl: "https://puretrance.com/feed/",
    type: "LABEL_RADAR_RSS",
  },
  {
    name: "Resident Advisor Trance News",
    url: "https://ra.co/news?genres=trance",
    feedUrl: "https://ra.co/news?genres=trance",
    type: "RA_NEWS_HTML",
  },
  {
    name: "TranceFix",
    url: "https://www.trancefix.nl/",
    feedUrl: "https://www.trancefix.nl/forums/-/index.rss?order=post_date",
    type: "RSS",
  },
  {
    name: "Trance Attack",
    url: "https://www.tranceattack.net/",
    feedUrl: "https://www.tranceattack.net/feed/",
    type: "RSS",
  },
  {
    name: "Trancentral",
    url: "https://www.trancentral.tv/",
    feedUrl: "https://www.trancentral.tv/feed/",
    type: "RSS",
  },
  {
    name: "We Rave You Trance",
    url: "https://weraveyou.com/category/genres/trance/",
    feedUrl: "https://weraveyou.com/category/genres/trance/feed/",
    type: "RSS",
  },
  {
    name: "We Rave You Fun Radar",
    url: "https://weraveyou.com/fun-radar",
    feedUrl: "https://weraveyou.com/feed/",
    type: "FUN_RADAR_RSS",
  },
  {
    name: "Above & Beyond 官方频道动态",
    url: "https://www.youtube.com/@aboveandbeyond",
    feedUrl:
      "https://www.youtube.com/feeds/videos.xml?channel_id=UCVE-ybBDg3UHSUylEVdPAsw",
    type: "YOUTUBE_CHANNEL_RSS",
  },
  {
    name: "Anjunadeep 官方频道动态",
    url: "https://www.youtube.com/@anjunadeep",
    feedUrl:
      "https://www.youtube.com/feeds/videos.xml?channel_id=UCbDgBFAketcO26wz-pR6OKA",
    type: "YOUTUBE_CHANNEL_RSS",
  },
  {
    name: "Anjunachill 官方频道动态",
    url: "https://www.youtube.com/@anjunachill",
    feedUrl:
      "https://www.youtube.com/feeds/videos.xml?channel_id=UCV8pMjLasWLdoANBOICgahw",
    type: "YOUTUBE_CHANNEL_RSS",
  },
  {
    name: "Instagram #trancefamily 社媒雷达（需 API）",
    url: "https://www.instagram.com/explore/tags/trancefamily/",
    feedUrl: "https://www.instagram.com/explore/tags/trancefamily/",
    type: "INSTAGRAM_HASHTAG",
    enabled: false,
  },
  {
    name: "Instagram #astateoftrance 社媒雷达（需 API）",
    url: "https://www.instagram.com/explore/tags/astateoftrance/",
    feedUrl: "https://www.instagram.com/explore/tags/astateoftrance/",
    type: "INSTAGRAM_HASHTAG",
    enabled: false,
  },
];

async function main() {
  await Promise.all(
    defaultSources.map((source) =>
      prisma.source.upsert({
        where: { url: source.url },
        update: {
          name: source.name,
          feedUrl: source.feedUrl,
          type: source.type,
          enabled: source.enabled ?? true,
        },
        create: { ...source, enabled: source.enabled ?? true },
      }),
    ),
  );

  console.log(`Ensured ${defaultSources.length} default content sources.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
