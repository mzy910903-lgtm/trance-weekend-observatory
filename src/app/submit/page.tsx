export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <p className="font-mono text-sm uppercase tracking-[0.45em] text-sky-200">
        submit signal
      </p>
      <h2 className="mt-4 text-5xl font-semibold text-white">提交资讯链接</h2>
      <p className="mt-5 text-sm leading-7 text-zinc-400">
        只需要提交公开 URL。内容会先进入 pending，后台抓取和 AI 分析后仍需人工审核，不会自动发布。
      </p>

      {status === "success" ? (
        <div className="mt-6 rounded border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">
          收到。链接已进入观察局待审队列，发布前仍会人工审核。
        </div>
      ) : null}
      {status === "duplicate" ? (
        <div className="mt-6 rounded border border-yellow-300/20 bg-yellow-300/10 p-4 text-sm text-yellow-100">
          这条链接已经在队列里了，先不重复收录。
        </div>
      ) : null}

      <form
        action="/api/submissions"
        method="post"
        className="mt-8 space-y-5 rounded border border-white/10 bg-white/[0.03] p-5"
      >
        <label className="block">
          <span className="text-sm text-zinc-300">URL</span>
          <input
            required
            type="url"
            name="url"
            placeholder="https://..."
            className="mt-2 w-full rounded border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-sky-300"
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-300">投稿人昵称</span>
          <input
            required
            name="nickname"
            maxLength={40}
            className="mt-2 w-full rounded border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-sky-300"
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-300">备注</span>
          <textarea
            name="note"
            rows={4}
            maxLength={500}
            className="mt-2 w-full rounded border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-sky-300"
          />
        </label>
        <button className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-sky-200">
          送进观察局
        </button>
      </form>
    </main>
  );
}
