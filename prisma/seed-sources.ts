import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const defaultSources = [
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
          enabled: true,
        },
        create: { ...source, enabled: true },
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
