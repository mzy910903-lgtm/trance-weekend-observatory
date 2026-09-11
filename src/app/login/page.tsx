import QRCode from "qrcode";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentMember, safeReturnPath } from "@/lib/member-auth";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  invite_invalid: "邀请码无效、已过期或次数已用完。",
  invite_required: "新成员需要邀请码才能加入观察局。",
  oauth_cancelled: "微信授权没有完成，可以重新试一次。",
  oauth_failed: "微信登录暂时没有接通，请稍后重试。",
  state_invalid: "登录请求已过期，请重新开始。",
  not_configured: "微信登录尚未完成线上配置。",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const member = await getCurrentMember();
  const query = await searchParams;
  const next = safeReturnPath(query.next, "/me");
  if (member) redirect(next);

  const userAgent = (await headers()).get("user-agent") ?? "";
  const isWechat = /micromessenger/i.test(userAgent);
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://observatory.tranceweekend.com";
  const qrUrl = `${siteUrl}/login?next=${encodeURIComponent(next)}`;
  const qrCode = await QRCode.toDataURL(qrUrl, {
    margin: 1,
    width: 360,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <div className="grid overflow-hidden rounded border border-white/10 bg-white/[0.03] lg:grid-cols-[1fr_400px]">
        <section className="p-7 md:p-12">
          <p className="font-mono text-xs uppercase tracking-[0.4em] text-sky-200">
            members only frequency
          </p>
          <h2 className="mt-4 text-4xl font-semibold text-white md:text-6xl">
            进入你自己的传思雷达
          </h2>
          <p className="mt-5 max-w-xl text-base leading-8 text-zinc-400">
            内容依然公开。登录后可以收藏文章、关注标签，并让首页优先显示你关心的频段。
          </p>

          {query.error ? (
            <div className="mt-6 rounded border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
              {errorMessages[query.error] ?? "登录没有完成，请重新试一次。"}
            </div>
          ) : null}

          <div className="mt-8 space-y-5">
            <form action="/api/auth/wechat/start" method="post" className="space-y-3">
              <input type="hidden" name="next" value={next} />
              <label className="block text-sm text-zinc-300" htmlFor="inviteCode">
                首次加入的邀请码
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="inviteCode"
                  name="inviteCode"
                  placeholder="TW-XXXX-XXXX"
                  autoComplete="one-time-code"
                  className="min-w-0 flex-1 rounded border border-white/15 bg-black px-4 py-3 font-mono text-white outline-none transition focus:border-sky-300"
                />
                <button className="rounded bg-white px-5 py-3 font-semibold text-black transition hover:bg-sky-200">
                  用微信加入
                </button>
              </div>
            </form>

            <div className="flex items-center gap-3 text-xs text-zinc-600">
              <span className="h-px flex-1 bg-white/10" />
              已经加入过
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <form action="/api/auth/wechat/start" method="post">
              <input type="hidden" name="next" value={next} />
              <button className="w-full rounded border border-white/15 px-5 py-3 text-sm text-zinc-200 transition hover:border-sky-300 hover:text-white">
                已有账号，直接微信登录
              </button>
            </form>
          </div>

          <Link href="/" className="mt-8 inline-block text-sm text-zinc-500 hover:text-white">
            暂不登录，继续浏览
          </Link>
        </section>

        <aside className="border-t border-white/10 bg-white p-7 text-black lg:border-l lg:border-t-0">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-zinc-500">
            scan in wechat
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- generated QR data URL. */}
          <img src={qrCode} alt="微信扫码打开登录页" className="mt-5 w-full" />
          <p className="mt-4 text-sm leading-6 text-zinc-600">
            {isWechat
              ? "当前已在微信内打开，可以直接完成公众号授权。"
              : "请用微信扫一扫打开。首期登录仅支持已认证公众号的网页授权。"}
          </p>
        </aside>
      </div>
    </main>
  );
}
