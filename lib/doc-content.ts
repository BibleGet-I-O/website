import type { ComponentType } from "react";
import type { MDXComponents } from "mdx/types";

/** A docs page's compiled MDX (content/docs/<lang>/<slug>.mdx, or index.mdx), imported at build time. */
export async function docContent(lang: string, slug: string): Promise<ComponentType<{ components?: MDXComponents }>> {
  return (await import(`@/content/docs/${lang}/${slug}.mdx`)).default;
}
