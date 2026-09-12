import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMember, safeReturnPath } from "@/lib/member-auth";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  invite_invalid: "邀请码无效、已过期或次数已用完。",
  login_failed: "登录名或口令不正确。",
  login_name_invalid: "登录名只能使用中英文、数字、下划线、横线和点。",
  login_name_taken: "这个登录名已被使用，请换一个。",
  register_invalid: "请完整填写注册信息，口令至少 8 位且两次输入一致。",
  register_failed: "注册没有完成，请检查信息后重试。",
};

const inputClass =
  "mt-1 w-full rounded border border-white/15 bg-black px-4 py-3 text-white outline-none transition focus:border-sky-300";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const member = await getCurrentMember();
  const query = await searchParams;
  const next = safeReturnPath(query.next, "/me");
  if (member) redirect(next);

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <section className="border-b border-white/10 pb-8">
        <p className="font-mono text-xs uppercase tracking-[0.4em] text-sky-200">
          members only frequency
        </p>
        <h2 className="mt-4 text-4xl font-semibold text-white md:text-6xl">
          进入你自己的传思雷达
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-400">
          所有资讯始终公开。账号只用于保存收藏、关注标签和生成个人频段。
        </p>
        {query.error ? (
          <div className="mt-6 max-w-2xl rounded border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
            {errorMessages[query.error] ?? "操作没有完成，请重新试一次。"}
          </div>
        ) : null}
      </section>

      <div className="grid gap-px overflow-hidden rounded border border-white/10 bg-white/10 lg:grid-cols-2">
        <section className="bg-[#050505] p-7 md:p-10">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-zinc-500">
            returning member
          </p>
          <h3 className="mt-3 text-2xl font-semibold text-white">已有账号</h3>
          <form action="/api/auth/login" method="post" className="mt-7 space-y-4">
            <input type="hidden" name="next" value={next} />
            <label className="block text-sm text-zinc-300">
              登录名
              <input required name="loginName" minLength={2} maxLength={30} autoComplete="username" className={inputClass} />
            </label>
            <label className="block text-sm text-zinc-300">
              登录口令
              <input required type="password" name="password" minLength={8} maxLength={72} autoComplete="current-password" className={inputClass} />
            </label>
            <button className="w-full rounded bg-white px-5 py-3 font-semibold text-black transition hover:bg-sky-200">
              登录我的雷达
            </button>
          </form>
        </section>

        <section className="bg-white/[0.03] p-7 md:p-10">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-sky-200">
            first transmission
          </p>
          <h3 className="mt-3 text-2xl font-semibold text-white">邀请码注册</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            邀请码只在首次注册时使用，之后凭登录名和口令进入。
          </p>
          <form action="/api/auth/register" method="post" className="mt-6 space-y-4">
            <input type="hidden" name="next" value={next} />
            <label className="block text-sm text-zinc-300">
              邀请码
              <input required name="inviteCode" placeholder="TW-XXXX-XXXX" autoComplete="one-time-code" className={`${inputClass} font-mono`} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-zinc-300">
                登录名
                <input required name="loginName" minLength={2} maxLength={30} autoComplete="username" className={inputClass} />
              </label>
              <label className="block text-sm text-zinc-300">
                显示昵称
                <input required name="nickname" minLength={1} maxLength={30} autoComplete="nickname" className={inputClass} />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-zinc-300">
                设置口令
                <input required type="password" name="password" minLength={8} maxLength={72} autoComplete="new-password" className={inputClass} />
              </label>
              <label className="block text-sm text-zinc-300">
                再输一次
                <input required type="password" name="confirmPassword" minLength={8} maxLength={72} autoComplete="new-password" className={inputClass} />
              </label>
            </div>
            <button className="w-full rounded border border-sky-300/50 bg-sky-300 px-5 py-3 font-semibold text-black transition hover:bg-white">
              创建账号并进入
            </button>
          </form>
        </section>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-4 text-sm text-zinc-500">
        <span>不登录也能阅读全部资讯、查看本周雷达和投稿。</span>
        <Link href="/" className="text-zinc-300 transition hover:text-white">
          暂不登录，继续浏览
        </Link>
      </div>
    </main>
  );
}
