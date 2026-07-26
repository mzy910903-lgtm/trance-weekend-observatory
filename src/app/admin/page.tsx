import Link from "next/link";
import type { Article, ArticleTag, Source, Submission, Tag } from "@prisma/client";
import { categories, categoryLabel, SubmissionStatus } from "@/lib/categories";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { sourceTypeOptions } from "@/lib/source-types";

export const dynamic = "force-dynamic";

type SubmissionWithRelations = Submission & {
  source: Source | null;
  article:
    | (Article & {
        tags: (ArticleTag & { tag: Tag })[];
      })
    | null;
};

type SourceWithCounts = Source & {
  _count: { submissions: number; articles: number };
};

const statusFilters = [
  { key: "ALL", label: "全部" },
  { key: SubmissionStatus.PENDING, label: "待抓取" },
  { key: SubmissionStatus.ANALYZED, label: "已分析" },
  { key: SubmissionStatus.PUBLISHED, label: "已发布" },
] as const;

function statusClass(status: string) {
  if (status === SubmissionStatus.PENDING) {
    return "border-yellow-300/30 bg-yellow-300/10 text-yellow-100";
  }

  if (status === SubmissionStatus.ANALYZED) {
    return "border-sky-300/30 bg-sky-300/10 text-sky-100";
  }

  if (status === SubmissionStatus.PUBLISHED) {
    return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
  }

  return "border-red-300/30 bg-red-300/10 text-red-100";
}

function checklistItem(label: string, done: boolean) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs ${
        done
          ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
          : "border-yellow-300/30 bg-yellow-300/10 text-yellow-100"
      }`}
    >
      {done ? "✓" : "!"} {label}
    </span>
  );
}

function scrapeBadge(status?: string | null) {
  if (status === "SUCCESS") {
    return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
  }

  if (status === "PARTIAL") {
    return "border-yellow-300/30 bg-yellow-300/10 text-yellow-100";
  }

  if (status === "FAILED") {
    return "border-red-300/30 bg-red-300/10 text-red-100";
  }

  return "border-zinc-500/30 bg-white/[0.04] text-zinc-400";
}

function QueueCard({
  submission,
  returnTo,
}: {
  submission: SubmissionWithRelations;
  returnTo: string;
}) {
  return (
    <div className="rounded border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            {submission.status === SubmissionStatus.PENDING ? (
              <label className="flex items-center gap-2 text-zinc-300">
                <input
                  form="batch-analyze-form"
                  type="checkbox"
                  name="submissionId"
                  value={submission.id}
                  className="accent-sky-300"
                />
                选中
              </label>
            ) : null}
            <span
              className={`rounded-full border px-2 py-1 ${statusClass(
                submission.status,
              )}`}
            >
              {submission.status}
            </span>
            <span>/</span>
            <span>{formatDate(submission.createdAt)}</span>
            {submission.discoveredAt ? (
              <>
                <span>/</span>
                <span>发现于 {formatDate(submission.discoveredAt)}</span>
              </>
            ) : null}
            {submission.rawPublishedAt ? (
              <>
                <span>/</span>
                <span>原文时间 {formatDate(submission.rawPublishedAt)}</span>
              </>
            ) : null}
            {submission.article?.publishedAt ? (
              <>
                <span>/</span>
                <span>本站发布 {formatDate(submission.article.publishedAt)}</span>
              </>
            ) : null}
            <span>/</span>
            <span>{submission.nickname}</span>
            {submission.source ? (
              <>
                <span>/</span>
                <span>{submission.source.name}</span>
              </>
            ) : null}
          </div>
          <a
            href={submission.url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block break-all text-sm text-sky-200 hover:underline"
          >
            {submission.url}
          </a>
          {submission.note ? (
            <p className="mt-3 whitespace-pre-line text-sm text-zinc-400">
              备注：{submission.note}
            </p>
          ) : null}
        </div>

        {submission.status === SubmissionStatus.PENDING ||
        submission.status === SubmissionStatus.ANALYZED ||
        submission.status === SubmissionStatus.PUBLISHED ? (
          <div className="flex flex-wrap gap-2">
            {submission.status === SubmissionStatus.PENDING ? (
              <form
                action={`/api/admin/submissions/${submission.id}/scrape`}
                method="post"
              >
                <button className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-300 transition hover:border-sky-300 hover:text-white">
                  仅抓取预览
                </button>
              </form>
            ) : null}
            {submission.status === SubmissionStatus.PUBLISHED &&
            submission.article ? (
              <form
                action={`/api/admin/articles/${submission.article.id}/unpublish`}
                method="post"
              >
                <input type="hidden" name="returnTo" value={returnTo} />
                <button className="rounded-full border border-red-300/40 px-4 py-2 text-sm text-red-100 transition hover:bg-red-300 hover:text-black">
                  下线
                </button>
              </form>
            ) : (
              <form
                action={`/api/admin/submissions/${submission.id}/analyze`}
                method="post"
              >
                <button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-sky-200">
                  {submission.status === SubmissionStatus.ANALYZED
                    ? "重新抓取并分析"
                    : "抓取并分析"}
                </button>
              </form>
            )}
          </div>
        ) : null}
      </div>

      {submission.errorMessage ? (
        <div className="mt-5 rounded border border-red-300/20 bg-red-950/30 p-4">
          <p className="text-xs font-semibold text-red-100">抓取失败</p>
          <p className="mt-1 text-sm leading-6 text-red-100/80">
            {submission.errorMessage}
          </p>
        </div>
      ) : null}

      {submission.rawTitle ? (
        <div className="mt-5 grid gap-4 rounded border border-white/10 bg-black p-4 md:grid-cols-[180px_1fr]">
          <div className="overflow-hidden rounded border border-white/10 bg-zinc-950">
            {/* eslint-disable-next-line @next/next/no-img-element -- raw og:image can be any reviewed source. */}
            <img
              src={submission.rawImage || "/default-cover.svg"}
              alt=""
              className="aspect-[5/3] h-full w-full object-cover opacity-85"
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-zinc-500">原始抓取预览</p>
              <span
                className={`rounded-full border px-2 py-1 text-xs ${scrapeBadge(
                  submission.scrapeStatus,
                )}`}
              >
                {submission.scrapeStatus || "未抓取"}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-zinc-200">
              {submission.rawTitle}
            </p>
            {submission.rawDescription ? (
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {submission.rawDescription}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
              {submission.rawAuthor ? <span>作者：{submission.rawAuthor}</span> : null}
              {submission.rawPublishedAt ? (
                <span>原文时间：{formatDate(submission.rawPublishedAt)}</span>
              ) : null}
              {submission.scrapedAt ? (
                <span>抓取于：{formatDate(submission.scrapedAt)}</span>
              ) : null}
            </div>
            {submission.canonicalUrl ? (
              <p className="mt-2 break-all text-xs text-zinc-500">
                Canonical：{submission.canonicalUrl}
              </p>
            ) : null}
            {submission.scrapeMessage ? (
              <p className="mt-2 text-xs text-zinc-500">
                抓取信息：{submission.scrapeMessage}
              </p>
            ) : null}
            {submission.rawExcerpt ? (
              <p className="mt-3 line-clamp-4 text-sm leading-6 text-zinc-400">
                {submission.rawExcerpt}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {submission.article ? (
        <form
          action={`/api/admin/articles/${submission.article.id}/publish`}
          method="post"
          className="mt-5 grid gap-4"
        >
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className="rounded border border-white/10 bg-black p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
              publish checklist
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {checklistItem("来源链接", Boolean(submission.article.sourceUrl))}
              {checklistItem(
                "原文时间",
                Boolean(
                  submission.article.sourcePublishedAt ||
                    submission.rawPublishedAt,
                ),
              )}
              {checklistItem("短摘要", Boolean(submission.article.summary))}
              {checklistItem("主图", Boolean(submission.article.coverImage))}
              {checklistItem("标签", submission.article.tags.length > 0)}
              {checklistItem(
                "三维评分",
                Boolean(
                  submission.article.importanceScore &&
                    submission.article.artistryScore &&
                    submission.article.humorScore,
                ),
              )}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="text-xs text-zinc-500">标题</span>
              <input
                name="title"
                defaultValue={submission.article.title}
                className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-sky-300"
              />
            </label>
            <label>
              <span className="text-xs text-zinc-500">分类</span>
              <select
                name="category"
                defaultValue={submission.article.category}
                className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-sky-300"
              >
                {categories.map((category) => (
                  <option key={category.key} value={category.key}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span className="text-xs text-zinc-500">短摘要</span>
            <textarea
              name="summary"
              defaultValue={submission.article.summary}
              rows={3}
              className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-sky-300"
            />
          </label>
          <label>
            <span className="text-xs text-zinc-500">完整摘要</span>
            <textarea
              name="fullSummary"
              defaultValue={submission.article.fullSummary}
              rows={5}
              className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-sky-300"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <label>
              <span className="text-xs text-zinc-500">重要性</span>
              <input
                type="number"
                min="1"
                max="10"
                name="importanceScore"
                defaultValue={submission.article.importanceScore}
                className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-sky-300"
              />
            </label>
            <label>
              <span className="text-xs text-zinc-500">艺术性</span>
              <input
                type="number"
                min="1"
                max="10"
                name="artistryScore"
                defaultValue={submission.article.artistryScore}
                className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-sky-300"
              />
            </label>
            <label>
              <span className="text-xs text-zinc-500">幽默性</span>
              <input
                type="number"
                min="1"
                max="10"
                name="humorScore"
                defaultValue={submission.article.humorScore}
                className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-sky-300"
              />
            </label>
          </div>
          <label>
            <span className="text-xs text-zinc-500">评分解释</span>
            <textarea
              name="scoreExplanation"
              defaultValue={submission.article.scoreExplanation}
              rows={3}
              className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-sky-300"
            />
          </label>
          <label>
            <span className="text-xs text-zinc-500">传思味儿点评</span>
            <input
              name="aiComment"
              defaultValue={submission.article.aiComment}
              className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-sky-300"
            />
          </label>
          <label>
            <span className="text-xs text-zinc-500">标签，英文逗号分隔</span>
            <input
              name="tags"
              defaultValue={submission.article.tags
                .map(({ tag }) => tag.name)
                .join(", ")}
              className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-sky-300"
            />
          </label>
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-zinc-500">
              当前分类：{categoryLabel(submission.article.category)} /
              来源链接已保留 / 原文时间：
              {formatDate(
                submission.article.sourcePublishedAt ||
                  submission.rawPublishedAt,
              )}
            </span>
            <button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-sky-200">
              保存并发布
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function SourcesPanel({ sources }: { sources: SourceWithCounts[] }) {
  return (
    <section className="mt-8">
      <div className="mb-5 flex flex-col gap-3 rounded border border-white/10 bg-white/[0.03] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">来源扫描雷达</h3>
          <p className="mt-1 text-sm text-zinc-400">
            扫描所有启用来源，只创建 pending 投稿，不自动分析或发布。
          </p>
        </div>
        <form action="/api/admin/sources/scan-all" method="post">
          <button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-sky-200">
            扫描全部启用来源
          </button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form
        action="/api/admin/sources"
        method="post"
        className="h-fit rounded border border-white/10 bg-white/[0.03] p-5"
      >
        <h3 className="text-lg font-semibold text-white">添加内容源</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          支持 RSS/Atom、指定 HTML、YouTube 频道 RSS 和 Instagram hashtag radar。扫描只会发现链接并放入 pending，不会自动分析或发布。
        </p>
        <label className="mt-5 block">
          <span className="text-xs text-zinc-500">来源类型</span>
          <select
            name="type"
            defaultValue="RSS"
            className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-sky-300"
          >
            {sourceTypeOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-5 block">
          <span className="text-xs text-zinc-500">来源名称</span>
          <input
            required
            name="name"
            placeholder="例如 Anjunabeats"
            className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-sky-300"
          />
        </label>
        <label className="mt-4 block">
          <span className="text-xs text-zinc-500">主页 URL</span>
          <input
            required
            type="url"
            name="url"
            placeholder="https://example.com"
            className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-sky-300"
          />
        </label>
        <label className="mt-4 block">
          <span className="text-xs text-zinc-500">扫描入口 URL</span>
          <input
            required
            type="url"
            name="feedUrl"
            placeholder="https://example.com/feed.xml 或指定 HTML 页面"
            className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-sky-300"
          />
        </label>
        <button className="mt-5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-sky-200">
          保存来源
        </button>
      </form>

      <div className="space-y-4">
        {sources.length === 0 ? (
          <div className="rounded border border-white/10 p-8 text-zinc-400">
            暂无内容源。先添加一个 RSS 频段。
          </div>
        ) : (
          sources.map((source) => (
            <div
              key={source.id}
              className="rounded border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span
                      className={`rounded-full border px-2 py-1 ${
                        source.enabled
                          ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
                          : "border-zinc-500/30 bg-white/[0.04] text-zinc-400"
                      }`}
                    >
                      {source.enabled ? "启用" : "停用"}
                    </span>
                    <span>/</span>
                    <span>{source.type}</span>
                    <span>/</span>
                    <span>
                      投稿 {source._count.submissions} / 文章{" "}
                      {source._count.articles}
                    </span>
                  </div>
                  <h3 className="mt-2 text-xl font-semibold text-white">
                    {source.name}
                  </h3>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block break-all text-sm text-sky-200 hover:underline"
                  >
                    {source.url}
                  </a>
                  {source.feedUrl ? (
                    <p className="mt-2 break-all text-xs text-zinc-500">
                      Feed：{source.feedUrl}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-yellow-100/80">
                      未配置扫描入口，不参与自动扫描。
                    </p>
                  )}
                  <p className="mt-2 text-xs text-zinc-500">
                    上次扫描：{formatDate(source.lastScannedAt)}
                  </p>
                  {source.lastScanStatus ? (
                    <p
                      className={`mt-2 text-xs ${
                        source.lastScanStatus === "SUCCESS"
                          ? "text-emerald-200/80"
                          : "text-red-100/80"
                      }`}
                    >
                      最近结果：{source.lastScanStatus} / 新增{" "}
                      {source.lastScanNewItems} /{" "}
                      {source.lastScanMessage || "无消息"}
                    </p>
                  ) : null}
                  {source.lastSuccessfulScanAt ? (
                    <p className="mt-2 text-xs text-zinc-500">
                      上次成功：{formatDate(source.lastSuccessfulScanAt)}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {source.feedUrl && source.enabled ? (
                    <form
                      action={`/api/admin/sources/${source.id}/scan`}
                      method="post"
                    >
                      <button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-sky-200">
                        扫描来源
                      </button>
                    </form>
                  ) : null}
                  <form
                    action={`/api/admin/sources/${source.id}/toggle`}
                    method="post"
                  >
                    <button className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-300 transition hover:border-sky-300 hover:text-white">
                      {source.enabled ? "停用" : "启用"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      </div>
    </section>
  );
}

function QueuePanel({
  submissions,
  activeStatus,
}: {
  submissions: SubmissionWithRelations[];
  activeStatus: string | undefined;
}) {
  const pendingCount = submissions.filter(
    (submission) => submission.status === SubmissionStatus.PENDING,
  ).length;
  const returnTo =
    activeStatus === "ALL"
      ? "/admin?status=ALL"
      : activeStatus
      ? `/admin?status=${activeStatus}`
      : "/admin";
  const isDraftReview = activeStatus === SubmissionStatus.ANALYZED;

  return (
    <>
      {isDraftReview ? (
        <div className="mt-6 rounded border border-sky-300/20 bg-sky-300/10 p-4 text-sm leading-6 text-sky-100">
          这里是资讯 + 趣闻候选池，不是发歌列表。系统每天以 10 条为目标、20 条为上限，所有来源只收 7 天内内容；口碑厂牌与趣闻栏目只改变题材优先级，不放宽时效。普通单曲、Remix、EP 预览和低信号通稿会被筛掉。你每天手动精选 3 条发布即可。
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((item) => (
            <Link
              key={item.key}
              href={
                item.key === SubmissionStatus.ANALYZED
                  ? "/admin"
                  : `/admin?status=${item.key}`
              }
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                activeStatus === item.key
                  ? "border-sky-300 bg-sky-300 text-black"
                  : "border-white/10 text-zinc-300 hover:border-sky-300 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <form
          id="batch-analyze-form"
          action="/api/admin/submissions/analyze-batch"
          method="post"
        >
          <div className="flex flex-wrap gap-2">
            <button
              formAction="/api/admin/submissions/scrape-batch"
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-300 transition hover:border-sky-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              disabled={pendingCount === 0}
            >
              批量抓取预览
            </button>
            <button
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-300 transition hover:border-sky-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              disabled={pendingCount === 0}
            >
              批量分析选中 pending
            </button>
          </div>
        </form>
      </div>

      <section className="mt-8 space-y-5">
        {submissions.length === 0 ? (
          <div className="rounded border border-white/10 p-8 text-zinc-400">
            {isDraftReview
              ? "暂无候选草稿。可能今天频段安静，也可能普通发歌和低信号通稿都被挡在门外了。"
              : "暂无投稿。"}
          </div>
        ) : (
          submissions.map((submission) => (
            <QueueCard
              key={submission.id}
              submission={submission}
              returnTo={returnTo}
            />
          ))
        )}
      </section>
    </>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    tab?: string;
    scan?: string;
    scanError?: string;
  }>;
}) {
  const { status, tab, scan, scanError } = await searchParams;
  const activeTab = tab === "sources" ? "sources" : "queue";
  const activeStatus = statusFilters.some((item) => item.key === status)
    ? status
    : SubmissionStatus.ANALYZED;
  const [submissions, sources] = await Promise.all([
    prisma.submission.findMany({
      where:
        activeStatus && activeStatus !== "ALL" ? { status: activeStatus } : {},
      include: {
        source: true,
        article: { include: { tags: { include: { tag: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.source.findMany({
      include: {
        _count: { select: { submissions: true, articles: true } },
      },
      orderBy: [{ enabled: "desc" }, { updatedAt: "desc" }],
    }),
  ]);

  const tabLinkClass = (key: "queue" | "sources") =>
    `rounded-full border px-4 py-2 text-sm transition ${
      activeTab === key
        ? "border-sky-300 bg-sky-300 text-black"
        : "border-white/10 text-zinc-300 hover:border-sky-300 hover:text-white"
    }`;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <p className="font-mono text-sm uppercase tracking-[0.45em] text-sky-200">
        admin console
      </p>
      <h2 className="mt-4 text-5xl font-semibold text-white">后台审核</h2>
      <p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-400">
        所有抓取结果先保存在草稿。管理员编辑后点击发布，才会进入首页资讯流。
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/admin" className={tabLinkClass("queue")}>
          投稿队列
        </Link>
        <Link href="/admin?tab=sources" className={tabLinkClass("sources")}>
          内容源
        </Link>
        <form action="/api/admin/logout" method="post">
          <button className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:border-sky-300 hover:text-white">
            退出后台
          </button>
        </form>
      </div>

      {scan ? (
        <div className="mt-5 rounded border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">
          扫描完成：新增 {scan} 条 pending 资讯。
        </div>
      ) : null}
      {scanError ? (
        <div className="mt-5 rounded border border-red-300/20 bg-red-950/30 p-4 text-sm text-red-100">
          {decodeURIComponent(scanError)}
        </div>
      ) : null}

      {activeTab === "sources" ? (
        <SourcesPanel sources={sources} />
      ) : (
        <QueuePanel submissions={submissions} activeStatus={activeStatus} />
      )}
    </main>
  );
}
