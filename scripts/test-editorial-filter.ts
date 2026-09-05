import assert from "node:assert/strict";
import { calculateContextLimit } from "../src/lib/auto-draft";
import { judgeAutoDraftCandidate } from "../src/lib/editorial-filter";
import {
  filterFunRadarItems,
  filterGenericEdmItems,
  filterYouTubeItems,
} from "../src/lib/source-filters";
import { classifyTranceScope } from "../src/lib/trance-relevance";

const genericSource = { name: "We Rave You", type: "GENERIC_EDM_RSS" };
const funSource = { name: "MusicTech Fun Radar", type: "FUN_RADAR_RSS" };
for (const [title, excerpt, accepted] of [
  ["Mike Rish [Interview + Premiere]", "Progressive house producer discusses founding a label and creative decisions.", true],
  ["John Digweed in conversation", "The DJ discusses Bedrock and club culture.", true],
  ["Premiere: Guy J - New Track", "Progressive house single out now.", false],
  ["Interview: a Future Rave producer", "Festival marketing campaign.", false],
] as const) {
  const candidate = { title, rawExcerpt: excerpt, url: "https://example.com/story", note: null, source: funSource };
  assert.equal(judgeAutoDraftCandidate(candidate).accepted, accepted, title);
  if (accepted) assert.equal(classifyTranceScope(candidate), "CONTEXT");
  assert.equal(filterFunRadarItems([{ title, excerpt, url: candidate.url, publishedAt: new Date() }], funSource).length, accepted ? 1 : 0, title);
}
const artistChannel = {
  name: "Above & Beyond 官方频道动态",
  type: "YOUTUBE_CHANNEL_RSS",
};

assert.equal(
  classifyTranceScope({
    title: "Cloonee and Prospa continue collaborative run with 'Good Girl'",
    url: "https://example.com/cloonee",
  }),
  "OFF_TOPIC",
);
assert.equal(
  classifyTranceScope({
    title: "Water Bear on building an international Future Rave career",
    url: "https://example.com/future-rave",
  }),
  "OFF_TOPIC",
);
assert.equal(
  classifyTranceScope({
    title: "Above & Beyond announce Anjunabeats classics set at Dreamstate",
    url: "https://example.com/dreamstate",
  }),
  "CORE",
);
assert.equal(
  classifyTranceScope({
    title: "Vangelis's first Yamaha CS-80 was listed on Reverb",
    url: "https://example.com/vangelis",
  }),
  "CONTEXT",
);
assert.equal(
  classifyTranceScope({
    title: "SoundCloud acquires key assets after Nina Protocol shutdown",
    url: "https://example.com/soundcloud-nina",
    source: funSource,
  }),
  "CONTEXT",
);
assert.equal(
  classifyTranceScope({
    title: "Kraftwerk retrospective traces the roots of rave culture",
    url: "https://example.com/kraftwerk-retrospective",
  }),
  "CONTEXT",
);

assert.deepEqual(
  filterGenericEdmItems(
    [
      {
        title: "Above & Beyond announce Anjunabeats classics set at Dreamstate",
        url: "https://example.com/dreamstate",
        publishedAt: new Date(),
        excerpt: "",
      },
      {
        title: "Future Rave producer announces a new release",
        url: "https://example.com/future-rave",
        publishedAt: new Date(),
        excerpt: "",
      },
    ],
    genericSource,
  ).map((item) => item.url),
  ["https://example.com/dreamstate"],
);

assert.deepEqual(
  filterFunRadarItems(
    [
      {
        title: "Vangelis's first Yamaha CS-80 was listed on Reverb",
        url: "https://example.com/vangelis",
        publishedAt: new Date(),
        excerpt: "",
      },
      {
        title: "New studio monitor launches with more bass",
        url: "https://example.com/monitor",
        publishedAt: new Date(),
        excerpt: "",
      },
    ],
    funSource,
  ).map((item) => item.url),
  ["https://example.com/vangelis"],
);

assert.deepEqual(
  filterYouTubeItems(
    [
      {
        title: "Above & Beyond announce a new tour date",
        url: "https://youtube.example.com/tour",
        publishedAt: new Date(),
        excerpt: "",
      },
      {
        title: "Above & Beyond - Full Set from the festival",
        url: "https://youtube.example.com/full-set",
        publishedAt: new Date(),
        excerpt: "",
      },
    ],
    artistChannel,
  ).map((item) => item.url),
  ["https://youtube.example.com/tour"],
);

assert.equal(
  judgeAutoDraftCandidate({
    title: "Above & Beyond announce Anjunabeats classics set at Dreamstate",
    url: "https://example.com/dreamstate",
    rawExcerpt: "",
    note: null,
    source: genericSource,
  }).accepted,
  true,
);
assert.equal(
  judgeAutoDraftCandidate({
    title: "Cloonee and Prospa continue collaborative run with 'Good Girl'",
    url: "https://example.com/cloonee",
    rawExcerpt: "",
    note: null,
    source: funSource,
  }).accepted,
  false,
);

assert.equal(calculateContextLimit(20, 16), 4);
assert.equal(calculateContextLimit(10, 8), 2);
assert.equal(calculateContextLimit(20, 3), 0);
assert.equal(calculateContextLimit(30, 10, 0.4), 6);

console.log("Editorial relevance checks passed.");
