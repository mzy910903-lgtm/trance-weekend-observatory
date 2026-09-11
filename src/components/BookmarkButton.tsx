import Link from "next/link";

export function BookmarkButton({
  articleId,
  bookmarked,
  loggedIn,
  returnTo,
}: {
  articleId: string;
  bookmarked: boolean;
  loggedIn: boolean;
  returnTo: string;
}) {
  if (!loggedIn) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(returnTo)}`}
        className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-sky-300 hover:text-white"
      >
        + 收藏
      </Link>
    );
  }
  return (
    <form action={`/api/member/bookmarks/${articleId}`} method="post">
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        className={`rounded-full border px-3 py-1.5 text-xs transition ${
          bookmarked
            ? "border-sky-300 bg-sky-300 text-black"
            : "border-white/15 text-zinc-300 hover:border-sky-300 hover:text-white"
        }`}
      >
        {bookmarked ? "已收藏" : "+ 收藏"}
      </button>
    </form>
  );
}
