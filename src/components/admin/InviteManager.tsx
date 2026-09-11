"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type InviteView = {
  id: string;
  codePrefix: string;
  note: string | null;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  enabled: boolean;
  createdAt: string;
  redemptions: { id: string; createdAt: string; nickname: string }[];
};

export function InviteManager({ invites }: { invites: InviteView[] }) {
  const router = useRouter();
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  return (
    <section className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
      <form
        className="h-fit rounded border border-white/10 bg-white/[0.03] p-5"
        onSubmit={async (event) => {
          event.preventDefault();
          setWorking(true);
          setError(null);
          const form = new FormData(event.currentTarget);
          const response = await fetch("/api/admin/invites", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              note: form.get("note"),
              maxUses: form.get("maxUses"),
              expiresAt: form.get("expiresAt"),
            }),
          });
          const result = (await response.json()) as { code?: string; error?: string };
          setWorking(false);
          if (!response.ok || !result.code) {
            setError(result.error ?? "创建失败");
            return;
          }
          setCreatedCode(result.code);
          event.currentTarget.reset();
          router.refresh();
        }}
      >
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-sky-200">
          invite control
        </p>
        <h3 className="mt-2 text-xl font-semibold text-white">创建邀请码</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          完整邀请码只显示一次。后端只保存哈希，无法找回明文。
        </p>
        <label className="mt-5 block text-xs text-zinc-500">
          备注
          <input
            name="note"
            maxLength={120}
            placeholder="例如：9 月首批群友"
            className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-sky-300"
          />
        </label>
        <label className="mt-4 block text-xs text-zinc-500">
          可使用次数
          <input
            required
            type="number"
            name="maxUses"
            min={1}
            max={100}
            defaultValue={1}
            className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-sky-300"
          />
        </label>
        <label className="mt-4 block text-xs text-zinc-500">
          有效期，可留空
          <input
            type="date"
            name="expiresAt"
            className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-sky-300"
          />
        </label>
        <button
          disabled={working}
          className="mt-5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-sky-200 disabled:opacity-50"
        >
          {working ? "正在生成" : "生成邀请码"}
        </button>
        {error ? <p className="mt-3 text-sm text-red-200">{error}</p> : null}
        {createdCode ? (
          <div className="mt-5 rounded border border-sky-300/30 bg-sky-300/10 p-4">
            <p className="text-xs text-sky-100">新邀请码，请立即保存并发送</p>
            <p className="mt-2 select-all font-mono text-2xl text-white">{createdCode}</p>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(createdCode)}
              className="mt-3 text-xs text-sky-200 underline"
            >
              复制邀请码
            </button>
          </div>
        ) : null}
      </form>

      <div className="space-y-4">
        {invites.length ? (
          invites.map((invite) => (
            <article key={invite.id} className="rounded border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`rounded-full border px-2 py-1 ${invite.enabled ? "border-emerald-300/30 text-emerald-100" : "border-zinc-500/30 text-zinc-500"}`}>
                      {invite.enabled ? "启用" : "停用"}
                    </span>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-zinc-400">
                      已用 {invite.usedCount} / {invite.maxUses}
                    </span>
                  </div>
                  <h3 className="mt-3 font-mono text-xl text-white">{invite.codePrefix}••••</h3>
                  <p className="mt-2 text-sm text-zinc-400">{invite.note || "无备注"}</p>
                  <p className="mt-2 text-xs text-zinc-600">
                    创建 {new Date(invite.createdAt).toLocaleDateString("zh-CN")} / 到期 {invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString("zh-CN") : "不限"}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    await fetch(`/api/admin/invites/${invite.id}/toggle`, { method: "POST" });
                    router.refresh();
                  }}
                  className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-300 hover:border-sky-300"
                >
                  {invite.enabled ? "停用" : "重新启用"}
                </button>
              </div>
              {invite.redemptions.length ? (
                <div className="mt-4 border-t border-white/10 pt-4 text-sm text-zinc-400">
                  {invite.redemptions.map((redemption) => (
                    <p key={redemption.id}>
                      {redemption.nickname} / {new Date(redemption.createdAt).toLocaleString("zh-CN")}
                    </p>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="rounded border border-white/10 p-8 text-zinc-400">还没有邀请码。</div>
        )}
      </div>
    </section>
  );
}
