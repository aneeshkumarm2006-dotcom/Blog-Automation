export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function slugifyBlog(title: string | undefined, fallback: string): string {
  const slug = title ? slugify(title) : "";
  return slug || slugify(fallback) || "blog";
}
