"use client";

import { useState } from "react";

export function CopyWeeklyLink() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }}
      className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-sky-200"
    >
      {copied ? "链接已复制" : "复制本周雷达链接"}
    </button>
  );
}
