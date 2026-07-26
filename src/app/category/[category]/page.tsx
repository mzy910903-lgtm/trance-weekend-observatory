import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import {
  articleSorts,
  getPopularTags,
  getPublishedArticles,
  normalizeArticleSort,
} from "@/lib/articles";
import { categoryBySlug } from "@/lib/categories";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { category: slug } = await params;
  const { sort } = await searchParams;
  const category = categoryBySlug(slug);
  if (!category) notFound();

  const activeSort = normalizeArticleSort(sort);
  const articles = await getPublishedArticles({
    category: category.key,
    sort,
  });
  const popularTags = getPopularTags(articles, 10);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <section className="rounded border border-white/10 bg-white/[0.03] p-6">
        <p className="font-mono text-sm uppercase tracking-[0.45em] text-zinc-500">
          category
        </p>
        <h2 className="mt-3 text-5xl font-semibold text-white">
          {category.label}
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400">
          {category.description}
        </p>

        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {popularTags.length > 0 ? (
              popularTags.map(({ tag, count }) => (
                <Link
                  key={tag.id}
                  href={`/tags/${tag.slug}`}
                  className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-sky-300 hover:text-black"
                >
                  #{tag.name} {count}
                </Link>
              ))
            ) : (
              <span className="text-sm text-zinc-500">暂无热门标签。</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {articleSorts.map((item) => (
              <Link
                key={item.key}
                href={
                  item.key === "latest"
                    ? `/category/${category.slug}`
                    : `/category/${category.slug}?sort=${item.key}`
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
