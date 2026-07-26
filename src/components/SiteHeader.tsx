import Link from "next/link";
import { categories } from "@/lib/categories";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-black/88 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-5 md:flex-row md:items-end md:justify-between">
        <Link href="/" className="group">
          <p className="text-xs uppercase tracking-[0.5em] text-zinc-500">
            Trance Weekend
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            传思宇宙观察局
          </h1>
        </Link>
        <nav className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/category/${category.slug}`}
              className="rounded-full border border-white/10 px-3 py-1.5 transition hover:border-sky-300 hover:text-white"
            >
              {category.label}
            </Link>
          ))}
          <Link
            href="/submit"
            className="rounded-full bg-white px-3 py-1.5 font-medium text-black transition hover:bg-sky-200"
          >
            投稿
          </Link>
          <Link
            href="/admin"
            className="rounded-full border border-white/20 px-3 py-1.5 text-zinc-400 transition hover:text-white"
          >
            后台
          </Link>
        </nav>
      </div>
    </header>
  );
}
