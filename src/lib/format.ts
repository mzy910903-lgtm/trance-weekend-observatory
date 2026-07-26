export function formatDate(date?: Date | null) {
  if (!date) return "待发布";

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatSourceDate(date?: Date | null) {
  return date ? formatDate(date) : "来源时间待核验";
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 72);
}
