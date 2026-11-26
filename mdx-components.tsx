import type { MDXComponents } from "mdx/types";
import { isValidElement, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { headingId } from "@/lib/docs";

/** A node's plain text, through any markup inside it. */
function textOf(n: ReactNode): string {
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(n)) return textOf(n.props.children);
  return "";
}

/** A section heading that links to itself: its `id` if given (<H2 id="esther">, kept in every translation), else its text's. */
export function heading(Tag: "h2" | "h3") {
  return function Heading({ id, children }: { id?: string; children?: ReactNode }) {
    const anchor = id ?? headingId(textOf(children));
    return (
      <Tag id={anchor}>
        <a href={`#${anchor}`}>{children}</a>
      </Tag>
    );
  };
}

export const components: MDXComponents = {
  h2: heading("h2"),
  h3: heading("h3"),
  a: ({ href = "", children }) =>
    href.startsWith("/") ? (
      <Link href={href}>{children}</Link>
    ) : (
      <a href={href} rel={href.startsWith("#") ? undefined : "external"}>
        {children}
      </a>
    ),
};

export function useMDXComponents(): MDXComponents {
  return components;
}
