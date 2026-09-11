import Link from "next/link";

export function TagFollowButton({
  tagId,
  followed,
  loggedIn,
  returnTo,
}: {
  tagId: string;
  followed: boolean;
  loggedIn: boolean;
  returnTo: string;
}) {
  if (!loggedIn) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(returnTo)}`}
        className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-zinc-300 hover:border-sky-300"
      >
        + 关注
      </Link>
    );
  }
  return (
    <form action={`/api/member/tags/${tagId}`} method="post">
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        className={`rounded-full border px-3 py-1.5 text-xs transition ${
          followed
            ? "border-sky-300 bg-sky-300 text-black"
            : "border-white/15 text-zinc-300 hover:border-sky-300"
        }`}
      >
        {followed ? "已关注" : "+ 关注"}
      </button>
    </form>
  );
}
