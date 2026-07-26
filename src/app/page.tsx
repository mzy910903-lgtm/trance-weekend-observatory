import Link from "next/link";
import { ArticleCard } from "@/components/ArticleCard";
import {
  articleSorts,
  getHomeRadar,
  normalizeArticleSort,
  type ArticleWithTags,
} from "@/lib/articles";
import { categories } from "@/lib/categories";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams: Promise<{ sort?: string }>;
};

function RadarMeter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-xs text-zinc-500">{label}</span>
        <span className="font-mono text-xl text-white">{value}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-sky-300"
          style={{ width: `${Math.max(0, Math.min(value, 10)) * 10}%` }}
        />
      </div>
    </div>
  );
}

function HighlightList({
  title,
  metric,
  articles,
}: {
  title: string;
  metric: "importanceScore" | "artistryScore" | "humorScore";
  articles: ArticleWithTags[];
}) {
  return (
    <div className="rounded border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="mt-4 space-y-4">
        {articles.map((article, index) => (
          <Link
            key={article.id}
            href={`/articles/${article.slug}`}
            className="grid grid-cols-[2rem_1fr_auto] gap-3 text-sm transition hover:text-sky-200"
          >
            <span className="font-mono text-zinc-600">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="line-clamp-2 text-zinc-200">{article.title}</span>
            <span className="font-mono text-white">{article[metric]}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SortLinks({ activeSort }: { activeSort: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {articleSorts.map((sort) => (
        <Link
          key={sort.key}
          href={sort.key === "latest" ? "/" : `/?sort=${sort.key}`}
          className={`rounded-full border px-3 py-1.5 text-sm transition ${
            activeSort === sort.key
              ? "border-sky-300 bg-sky-300 text-black"
              : "border-white/10 text-zinc-300 hover:border-sky-300 hover:text-white"
          }`}
        >
          {sort.label}
        </Link>
      ))}
    </div>
  );
}

export default async function Home({ searchParams }: HomeProps) {
  const { sort } = await searchParams;
  const activeSort = normalizeArticleSort(sort);
  const { articles, leadArticle, highlights, stats, popularTags } =
    await getHomeRadar(sort);
  const feedArticles = articles.filter((article) => article.id !== leadArticle?.id);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <section className="grid gap-8 border-b border-white/10 pb-10 lg:grid-cols-[1fr_420px] lg:items-end">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.45em] text-sky-200">
            今日传思浓度检测中……
          </p>
          <h2 className="mt-5 max-w-4xl text-5xl font-semibold leading-none tracking-tight text-white md:text-7xl">
            从地下频谱里捞出值得听、值得笑、值得认真吵一架的 Trance 资讯。
          </h2>
          <div className="mt-8 flex flex-wrap gap-2">
            {categories.map((category) => (
              <Link
                key={category.key}
                href={`/category/${category.slug}`}
                className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-sky-300 hover:text-white"
              >
                {category.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="relative overflow-hidden rounded border border-white/10 bg-zinc-950">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(125,211,252,0.20),transparent_35%),linear-gradient(180deg,transparent,rgba(0,0,0,0.50))]" />
          {/* eslint-disable-next-line @next/next/no-img-element -- local SVG brand visual. */}
          <img
            src="/default-cover.svg"
            alt="Trance Weekend 观察局频谱视觉"
            className="aspect-[5/3] w-full object-cover opacity-80 grayscale-[20%]"
          />
        </div>
      </section>

      <section className="grid gap-6 border-b border-white/10 py-8 lg:grid-cols-[1fr_340px]">
        {leadArticle ? (
          <ArticleCard article={leadArticle} variant="lead" />
        ) : (
          <div className="rounded border border-white/10 bg-white/[0.03] p-8 text-zinc-400">
            这片频段暂时安静。先去后台发布第一条资讯。
          </div>
        )}

        <aside className="space-y-5">
          <div className="rounded border border-sky-300/20 bg-sky-300/[0.06] p-5">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold text-sky-100">今日浓度</p>
              <p className="font-mono text-5xl text-white">{stats.density}</p>
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              基于最近 {stats.sampleSize} 条已发布资讯的三维均值。
            </p>
            <div className="mt-5 grid gap-4">
              <RadarMeter label="重要性" value={stats.importance} />
              <RadarMeter label="艺术性" value={stats.artistry} />
              <RadarMeter label="幽默性" value={stats.humor} />
            </div>
          </div>

          <div className="rounded border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-sm font-semibold text-white">热门标签</h3>
            <div className="mt-4 flex flex-wrap gap-2">
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
                <span className="text-sm text-zinc-500">暂无标签信号。</span>
              )}
            </div>
          </div>
        </aside>
      </section>

      <section className="grid gap-4 border-b border-white/10 py-8 lg:grid-cols-3">
        <HighlightList
          title="重要性高压区"
          metric="importanceScore"
          articles={highlights.importance}
        />
        <HighlightList
          title="艺术性泛光区"
          metric="artistryScore"
          articles={highlights.artistry}
        />
        <HighlightList
          title="幽默性失控区"
          metric="humorScore"
          articles={highlights.humor}
        />
      </section>

      <section className="py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-zinc-500">
              latest signal
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-white">最新资讯流</h2>
          </div>
          <SortLinks activeSort={activeSort} />
        </div>

        {feedArticles.length > 0 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {feedArticles.map((article) => (
              <ArticleCard key={article.id} article={article} variant="compact" />
            ))}
          </div>
        ) : articles.length > 0 ? (
          <div className="mt-6 rounded border border-white/10 p-8 text-zinc-400">
            雷达刚捕获第一条信号，更多资讯发布后会在这里展开。
          </div>
        ) : (
          <div className="mt-6 rounded border border-white/10 p-8 text-zinc-400">
            这片频段暂时安静。先运行 seed，或去后台分析一条投稿。
          </div>
        )}
      </section>
    </main>
  );
}
