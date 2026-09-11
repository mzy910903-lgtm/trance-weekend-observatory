import type { Metadata } from "next";
import { ArticleCard } from "@/components/ArticleCard";
import { CopyWeeklyLink } from "@/components/CopyWeeklyLink";
import { getViewerState } from "@/lib/member-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "本周雷达 | 传思宇宙观察局",
  description: "过去七天值得认真听、认真看，也值得笑一下的 Trance 资讯精选。",
  openGraph: {
    title: "本周雷达 | 传思宇宙观察局",
    description: "过去七天的 Trance 资讯与趣闻精选。",
    images: [
      {
        url: "/default-cover.png",
        width: 1200,
        height: 720,
        alt: "传思宇宙观察局本周雷达",
      },
    ],
  },
};

export default async function WeeklyPage() {
  // The weekly window is intentionally evaluated per dynamic request.
  // eslint-disable-next-line react-hooks/purity
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const articles = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { sourcePublishedAt: { gte: cutoff } },
        { sourcePublishedAt: null, publishedAt: { gte: cutoff } },
      ],
    },
    include: { tags: { include: { tag: true } } },
    orderBy: [
      { sourcePublishedAt: "desc" },
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ],
    take: 12,
  });
  const viewer = await getViewerState(articles.map((article) => article.id));

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <section className="relative overflow-hidden rounded border border-sky-300/20 bg-white/[0.03] p-7 md:p-12">
        <div className="absolute inset-y-0 right-0 hidden w-2/5 opacity-20 md:block">
          {/* eslint-disable-next-line @next/next/no-img-element -- local brand visual. */}
          <img src="/default-cover.svg" alt="" className="h-full w-full object-cover" />
        </div>
        <div className="relative max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.45em] text-sky-200">
            seven day transmission
          </p>
          <h2 className="mt-4 text-5xl font-semibold text-white md:text-7xl">本周雷达</h2>
          <p className="mt-5 text-base leading-8 text-zinc-300">
            过去七天，观察局捕获了 {articles.length} 条已经人工发布的信号。适合丢进群里，慢慢听，认真吵。
          </p>
          <div className="mt-7">
            <CopyWeeklyLink />
          </div>
        </div>
      </section>

      <section className="py-8">
        {articles.length ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                variant="compact"
                loggedIn={Boolean(viewer.user)}
                bookmarked={viewer.bookmarkedArticleIds.has(article.id)}
                returnTo="/weekly"
              />
            ))}
          </div>
        ) : (
          <div className="rounded border border-white/10 py-16 text-center text-zinc-400">
            这周的频段暂时安静，已发布旧闻仍留在首页。
          </div>
        )}
      </section>
    </main>
  );
}
