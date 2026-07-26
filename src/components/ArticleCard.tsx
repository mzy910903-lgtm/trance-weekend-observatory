import Link from "next/link";
import type { ArticleWithTags } from "@/lib/articles";
import { categoryLabel } from "@/lib/categories";
import { formatSourceDate } from "@/lib/format";
import { ScorePill } from "./ScorePill";

type ArticleCardProps = {
  article: ArticleWithTags;
  variant?: "default" | "compact" | "lead";
};

export function ArticleCard({ article, variant = "default" }: ArticleCardProps) {
  if (variant === "lead") {
    return (
      <article className="group overflow-hidden rounded border border-white/10 bg-white/[0.04]">
        <Link href={`/articles/${article.slug}`} className="block">
          <div className="relative aspect-[16/9] overflow-hidden bg-zinc-950">
            {/* eslint-disable-next-line @next/next/no-img-element -- og:image domains are user-submitted and reviewed before publish. */}
            <img
              src={article.coverImage || "/default-cover.svg"}
              alt=""
              className="h-full w-full object-cover opacity-85 transition duration-700 group-hover:scale-105 group-hover:opacity-100"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300">
                <span>{categoryLabel(article.category)}</span>
                <span>/</span>
                <span>{article.sourceName}</span>
                <span>/</span>
                <time>原文时间：{formatSourceDate(article.sourcePublishedAt)}</time>
              </div>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-white md:text-4xl">
                {article.title}
              </h2>
            </div>
          </div>
        </Link>
        <div className="p-5">
          <p className="text-sm leading-7 text-zinc-300">{article.summary}</p>
          <p className="mt-4 border-l border-sky-300/70 pl-4 text-sm text-sky-100">
            {article.aiComment}
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <ScorePill label="重要性" value={article.importanceScore} />
            <ScorePill label="艺术性" value={article.artistryScore} />
            <ScorePill label="幽默性" value={article.humorScore} />
          </div>
        </div>
      </article>
    );
  }

  const isCompact = variant === "compact";

  return (
    <article
      className={
        isCompact
          ? "grid gap-4 rounded border border-white/10 bg-white/[0.03] p-3"
          : "grid gap-5 border-b border-white/10 py-8 md:grid-cols-[240px_1fr]"
      }
    >
      <Link href={`/articles/${article.slug}`} className="group block">
        <div className="aspect-[5/3] overflow-hidden rounded border border-white/10 bg-zinc-950">
          {/* eslint-disable-next-line @next/next/no-img-element -- og:image domains are user-submitted and reviewed before publish. */}
          <img
            src={article.coverImage || "/default-cover.svg"}
            alt=""
            className="h-full w-full object-cover opacity-85 transition duration-500 group-hover:scale-105 group-hover:opacity-100"
          />
        </div>
      </Link>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span>{categoryLabel(article.category)}</span>
          <span>/</span>
          <span>{article.sourceName}</span>
          <span>/</span>
          <time>原文时间：{formatSourceDate(article.sourcePublishedAt)}</time>
        </div>
        <Link href={`/articles/${article.slug}`}>
          <h2
            className={`mt-3 font-semibold leading-tight text-white transition hover:text-sky-200 ${
              isCompact ? "text-lg" : "text-2xl"
            }`}
          >
            {article.title}
          </h2>
        </Link>
        <p
          className={`mt-3 max-w-3xl text-sm leading-7 text-zinc-300 ${
            isCompact ? "line-clamp-3" : ""
          }`}
        >
          {article.summary}
        </p>
        {isCompact ? null : (
          <p className="mt-4 border-l border-sky-300/70 pl-4 text-sm text-sky-100">
            {article.aiComment}
          </p>
        )}
        <div className={`mt-5 grid gap-2 ${isCompact ? "" : "sm:grid-cols-3"}`}>
          <ScorePill label="重要性" value={article.importanceScore} />
          <ScorePill label="艺术性" value={article.artistryScore} />
          <ScorePill label="幽默性" value={article.humorScore} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {article.tags.map(({ tag }) => (
            <Link
              key={tag.id}
              href={`/tags/${tag.slug}`}
              className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-zinc-300"
            >
              #{tag.name}
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}
