import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { ScorePill } from "@/components/ScorePill";
import { getRelatedArticles } from "@/lib/articles";
import { ArticleStatus, categories, categoryLabel } from "@/lib/categories";
import { formatSourceDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await prisma.article.findFirst({
    where: { slug, status: ArticleStatus.PUBLISHED },
    include: { tags: { include: { tag: true } } },
  });

  if (!article) notFound();

  const relatedArticles = await getRelatedArticles(article);
  const categorySlug =
    categories.find((category) => category.key === article.category)?.slug ??
    "news";

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <article>
          <div className="aspect-[16/8] overflow-hidden rounded border border-white/10 bg-zinc-950">
            {/* eslint-disable-next-line @next/next/no-img-element -- og:image domains are user-submitted and reviewed before publish. */}
            <img
              src={article.coverImage || "/default-cover.svg"}
              alt=""
              className="h-full w-full object-cover opacity-90"
            />
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span>{categoryLabel(article.category)}</span>
            <span>/</span>
            <span>{article.sourceName}</span>
            <span>/</span>
            <time>原文时间：{formatSourceDate(article.sourcePublishedAt)}</time>
          </div>
          <h2 className="mt-4 text-4xl font-semibold leading-tight text-white md:text-6xl">
            {article.title}
          </h2>
          <p className="mt-6 border-l border-sky-300/70 pl-4 text-lg leading-8 text-sky-100">
            {article.aiComment}
          </p>
          <div className="mt-8 space-y-5 text-base leading-8 text-zinc-300">
            {article.fullSummary.split("\n").map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <div className="mt-8 rounded border border-sky-300/20 bg-sky-300/[0.06] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-100">
              source locked
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">
              {article.sourceName}
            </h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              本站只展示短摘要与 AI 编辑点评，不全文转载。完整上下文请阅读原文。
            </p>
            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-sky-200"
            >
              阅读原文
            </a>
          </div>
        </article>

        <aside className="space-y-5">
          <div className="rounded border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-sm font-semibold text-white">三维评分</h3>
            <div className="mt-4 grid gap-3">
              <ScorePill label="重要性" value={article.importanceScore} />
              <ScorePill label="艺术性" value={article.artistryScore} />
              <ScorePill label="幽默性" value={article.humorScore} />
            </div>
          </div>
          <div className="rounded border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
              editor verdict
            </p>
            <h3 className="mt-2 text-sm font-semibold text-white">
              观察局判词
            </h3>
            <p className="mt-4 text-sm leading-7 text-zinc-400">
              {article.scoreExplanation}
            </p>
          </div>
          <div className="rounded border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-sm font-semibold text-white">相关标签</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {article.tags.map(({ tag }) => (
                <Link
                  key={tag.id}
                  href={`/tags/${tag.slug}`}
                  className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-sky-300 hover:text-black"
                >
                  #{tag.name}
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <section className="mt-12 border-t border-white/10 pt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-zinc-500">
              related signal
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-white">相关资讯</h2>
          </div>
          <Link
            href={`/category/${categorySlug}`}
            className="hidden text-sm text-zinc-400 transition hover:text-sky-200 md:block"
          >
            回到同类频段
          </Link>
        </div>
        {relatedArticles.length > 0 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {relatedArticles.map((related) => (
              <ArticleCard
                key={related.id}
                article={related}
                variant="compact"
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded border border-white/10 p-6 text-zinc-400">
            暂时没有相邻信号。
          </div>
        )}
      </section>
    </main>
  );
}
