export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-10">
      <p className="font-mono text-sm uppercase tracking-[0.45em] text-sky-200">
        admin gate
      </p>
      <h2 className="mt-4 text-5xl font-semibold text-white">后台登录</h2>
      <p className="mt-5 text-sm leading-7 text-zinc-400">
        请输入管理员口令。登录后本设备会默认保持 30 天登录状态，除非主动退出。
      </p>

      {error ? (
        <div className="mt-6 rounded border border-red-300/20 bg-red-950/30 p-4 text-sm text-red-100">
          口令不正确，或者生产环境尚未配置管理员环境变量。
        </div>
      ) : null}

      <form
        action="/api/admin/login"
        method="post"
        className="mt-8 space-y-5 rounded border border-white/10 bg-white/[0.03] p-5"
      >
        <input type="hidden" name="next" value={next || "/admin"} />
        <label className="block">
          <span className="text-sm text-zinc-300">管理员口令</span>
          <input
            required
            type="password"
            name="password"
            className="mt-2 w-full rounded border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-sky-300"
          />
        </label>
        <button className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-sky-200">
          进入后台
        </button>
      </form>
    </main>
  );
}
