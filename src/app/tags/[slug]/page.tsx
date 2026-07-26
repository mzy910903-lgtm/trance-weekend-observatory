import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import {
  articleSorts,
  getPublishedArticles,
  normalizeArticleSort,
} from "@/lib/articles";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { slug } = await params;
  const { sort } = await searchParams;
  const tag = await prisma.tag.findUnique({ where: { slug } });

  if (!tag) notFound();

  const activeSort = normalizeArticleSort(sort);
  const articles = await getPublishedArticles({ tagSlug: tag.slug, sort });

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <section className="rounded border border-white/10 bg-white/[0.03] p-6">
        <p className="font-mono text-sm uppercase tracking-[0.45em] text-zinc-500">
          tag frequency
        </p>
        <h2 className="mt-3 text-5xl font-semibold text-white">#{tag.name}</h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400">
          所有带有这个信号的已发布资讯。依然只展示短摘要，深入阅读请回到来源。
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {articleSorts.map((item) => (
            <Link
              key={item.key}
              href={
                item.key === "latest"
                  ? `/tags/${tag.slug}`
                  : `/tags/${tag.slug}?sort=${item.key}`
              }
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                activeSort === item.key
                  ? "border-sky-300 bg-sky-300 text-black"
                  : "border-white/10 text-zinc-300 hover:border-sky-300 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8">
        {articles.length > 0 ? (
          articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))
        ) : (
          <div className="rounded border border-white/10 py-16 text-center text-zinc-400">
            这片频段暂时安静。
          </div>
        )}
      </section>
    </main>
  );
}
