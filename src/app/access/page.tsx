import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCESS_GATE_COOKIE_NAME,
  verifyAccessSession,
} from "@/lib/access-gate";

export const metadata: Metadata = {
  title: "Access | Trance Weekend Lab",
  robots: { index: false, follow: false },
};

function safeNextPath(value?: string) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/api/access") ||
    value.length > 2_048
  ) {
    return "/";
  }
  return value;
}

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const target = safeNextPath(next);
  const session = (await cookies()).get(ACCESS_GATE_COOKIE_NAME)?.value;
  if (await verifyAccessSession(session)) redirect(target);

  return (
    <>
      <style>{`body > header { display: none; }`}</style>
      <main className="lab-access-gate relative grid min-h-svh place-items-center overflow-hidden bg-[#050505] px-5 py-12 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(103,232,249,0.12),transparent_34%),linear-gradient(135deg,rgba(217,70,239,0.07),transparent_40%)]" />
      <section className="relative w-full max-w-[390px]">
        <div className="mb-12 flex items-center justify-between border-b border-white/15 pb-4 font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500">
          <span>Private access</span>
          <span>30 days</span>
        </div>

        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.38em] text-cyan-200">
          Trance Weekend
        </p>
        <h1 className="mt-3 text-6xl font-black leading-none tracking-[-0.07em] sm:text-7xl">
          LAB
        </h1>
        <p className="mt-6 max-w-xs text-sm leading-6 text-zinc-400">
          内部实验现场。输入访问密码继续。
        </p>

        {error ? (
          <p className="mt-6 border-l-2 border-fuchsia-400 bg-fuchsia-400/10 px-4 py-3 text-sm text-zinc-200">
            {error === "config"
              ? "访问入口尚未完成服务端配置。"
              : "密码不正确，请再试一次。"}
          </p>
        ) : null}

        <form action="/api/access/login" method="post" className="mt-8">
          <input type="hidden" name="next" value={target} />
          <label className="block font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500">
            Access password
            <input
              required
              autoFocus
              minLength={8}
              autoComplete="current-password"
              type="password"
              name="password"
              className="mt-3 h-14 w-full rounded-none border border-white/20 bg-white/[0.04] px-4 font-sans text-lg tracking-[0.16em] text-white outline-none transition placeholder:text-zinc-700 focus:border-cyan-200 focus:bg-white/[0.07]"
              placeholder="••••••••"
            />
          </label>
          <button className="mt-4 flex h-14 w-full items-center justify-between bg-white px-5 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-black transition hover:bg-cyan-100">
            Enter the lab
            <span aria-hidden="true">↗</span>
          </button>
        </form>

        <p className="mt-8 font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-600">
          Session protected · HttpOnly · SameSite
        </p>
      </section>
      </main>
    </>
  );
}
