import type { MDXComponents } from "mdx/types";
import type { ReactNode } from "react";
import { ReaderLink } from "@/components/docs/ReaderLink";
import { Sources } from "@/components/docs/Sources";
import styles from "@/components/docs/docs.module.css";
import { heading } from "@/mdx-components";

/** The components a docs page may use: <Rubric>, <Sources>, <ReaderLink>, and <H2 id>/<H3 id> for headings whose anchor is fixed. */
export const docsComponents: MDXComponents = {
  Rubric: ({ children }: { children?: ReactNode }) => <span className={styles.rubric}>{children}</span>,
  Sources,
  ReaderLink,
  H2: heading("h2"),
  H3: heading("h3"),
};
