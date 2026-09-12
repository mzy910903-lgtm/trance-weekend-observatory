import Link from "next/link";
import { redirect } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { TagFollowButton } from "@/components/TagFollowButton";
import { getCurrentMember, recordMemberActivity } from "@/lib/member-auth";
import { prisma } from "@/lib/prisma";
import { DeleteMemberButton } from "@/components/DeleteMemberButton";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const user = await getCurrentMember();
  if (!user) redirect("/login?next=/me");
  await recordMemberActivity(user.id);

  const [follows, bookmarks] = await Promise.all([
    prisma.tagFollow.findMany({
      where: { userId: user.id },
      include: { tag: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.bookmark.findMany({
      where: { userId: user.id, article: { status: "PUBLISHED" } },
      include: {
        article: { include: { tags: { include: { tag: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const personalized = follows.length
    ? await prisma.article.findMany({
        where: {
          status: "PUBLISHED",
          tags: { some: { tagId: { in: follows.map((item) => item.tagId) } } },
        },
        include: { tags: { include: { tag: true } } },
        orderBy: [
          { sourcePublishedAt: "desc" },
          { publishedAt: "desc" },
          { createdAt: "desc" },
        ],
        take: 12,
      })
    : [];
  const bookmarkedIds = new Set(bookmarks.map(({ articleId }) => articleId));

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <section className="grid gap-6 border-b border-white/10 pb-8 md:grid-cols-[1fr_auto] md:items-end">
        <div className="flex items-center gap-5">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- WeChat profile image URL.
            <img
              src={user.avatarUrl}
              alt=""
              className="h-16 w-16 rounded border border-white/15 object-cover"
            />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded border border-sky-300/30 bg-sky-300/10 text-2xl text-sky-100">
              TW
            </div>
          )}
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.4em] text-sky-200">
              member radar
            </p>
            <h2 className="mt-2 text-4xl font-semibold text-white">{user.nickname}</h2>
            <p className="mt-2 text-sm text-zinc-500">
              关注 {follows.length} 个标签 / 收藏 {bookmarks.length} 条仍在线资讯
            </p>
          </div>
        </div>
        <form action="/api/member/logout" method="post">
          <button className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-300 hover:border-sky-300">
            退出登录
          </button>
        </form>
      </section>

      <section className="border-b border-white/10 py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-zinc-500">
              followed tags
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-white">正在监听</h3>
          </div>
        </div>
        {follows.length ? (
          <div className="mt-5 flex flex-wrap gap-3">
            {follows.map(({ tag }) => (
              <div
                key={tag.id}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-3 pr-1"
              >
                <Link href={`/tags/${tag.slug}`} className="text-sm text-zinc-200">
                  #{tag.name}
                </Link>
                <TagFollowButton tagId={tag.id} followed loggedIn returnTo="/me" />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-zinc-400">
            还没有关注标签。从文章详情或标签页开始监听一个频段。
          </p>
        )}
      </section>

      <section className="border-b border-white/10 py-8">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-sky-200">
          personal feed
        </p>
        <h3 className="mt-2 text-3xl font-semibold text-white">我的雷达</h3>
        {personalized.length ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {personalized.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                variant="compact"
                loggedIn
                bookmarked={bookmarkedIds.has(article.id)}
                returnTo="/me"
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded border border-white/10 p-8 text-zinc-400">
            关注标签后，这里只接收你在意的已发布信号。
          </div>
        )}
      </section>

      <section className="py-8">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-zinc-500">
          saved signals
        </p>
        <h3 className="mt-2 text-3xl font-semibold text-white">我的收藏</h3>
        {bookmarks.length ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {bookmarks.map(({ article }) => (
              <ArticleCard
                key={article.id}
                article={article}
                variant="compact"
                loggedIn
                bookmarked
                returnTo="/me"
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded border border-white/10 p-8 text-zinc-400">
            还没有收藏。看到值得回放的资讯，点一下“收藏”。
          </div>
        )}
      </section>

      <section className="border-t border-red-300/10 py-8">
        <h3 className="text-sm font-semibold text-red-100">个人数据</h3>
        <p className="mt-2 text-sm text-zinc-500">
          删除后会清除会员身份、登录会话、收藏和标签关注，无法恢复。
        </p>
        <DeleteMemberButton />
      </section>
    </main>
  );
}
