import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...p }: { href: string; children?: React.ReactNode }) => <a data-intl="1" href={href} {...p}>{children}</a>,
}));

import { components } from "@/mdx-components";
import { docsComponents } from "@/components/docs/mdx";
import { UntranslatedNotice } from "@/components/docs/UntranslatedNotice";

const H2 = components.h2 as React.FC<{ children: React.ReactNode }>;
const A = components.a as React.FC<{ href: string; children: React.ReactNode }>;
const FixedH2 = docsComponents.H2 as React.FC<{ id: string; children: React.ReactNode }>;
const Sources = docsComponents.Sources as React.FC<{ children: React.ReactNode }>;

describe("the docs' MDX components", () => {
  it("aMarkdownHeadingLinksToItself", () => {
    render(<H2>Il testo ebraico</H2>);
    const h = screen.getByRole("heading", { level: 2 });
    expect(h).toHaveAttribute("id", "il-testo-ebraico");
    expect(screen.getByRole("link")).toHaveAttribute("href", "#il-testo-ebraico");
  });

  it("aFixedIdHeadingKeepsItsId", () => {
    render(<FixedH2 id="esther">Ester</FixedH2>);
    expect(screen.getByRole("heading", { level: 2 })).toHaveAttribute("id", "esther");
    expect(screen.getByRole("link")).toHaveAttribute("href", "#esther");
  });

  it("internalLinksGoThroughTheI18nLinkAndOthersAreExternal", () => {
    render(<><A href="/docs/qumran">Q</A><A href="https://www.deadseascrolls.org.il/">D</A></>);
    expect(screen.getByRole("link", { name: "Q" })).toHaveAttribute("data-intl", "1");
    expect(screen.getByRole("link", { name: "D" })).toHaveAttribute("rel", "external");
  });

  it("sourcesHaveTheirHeading", () => {
    render(<Sources><ul><li>Dei Verbum</li></ul></Sources>, { locale: "it" });
    expect(screen.getByRole("heading", { name: "Fonti" })).toHaveAttribute("id", "sources");
  });

  it("theDraftsBannerSaysTheIdentifiersAreDrafts", () => {
    const Drafts = docsComponents.Drafts as React.FC;
    render(<Drafts />, { locale: "it" });
    expect(screen.getByRole("note")).toHaveTextContent("bozze");
    expect(screen.getByRole("note")).toHaveTextContent("v1.0.0");
  });

  it("theUntranslatedNoticeIsInTheInterfaceLanguage", () => {
    render(<UntranslatedNotice />, { locale: "it" });
    expect(screen.getByRole("note")).toHaveTextContent("Questa pagina non è ancora disponibile in italiano");
  });
});
