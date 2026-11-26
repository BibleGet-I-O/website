import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...p }: { href: string; children?: React.ReactNode }) => <a href={href} {...p}>{children}</a>,
}));
const { loaded } = vi.hoisted(() => ({ loaded: [] as string[] }));
vi.mock("@/lib/doc-content", () => ({
  docContent: async (lang: string, slug: string) => {
    loaded.push(`${lang}/${slug}`);
    return function Content() { return <p>The scrolls.</p>; };
  },
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));

import DocPage, { generateStaticParams } from "@/app/[locale]/docs/[page]/page";

describe("a docs page", () => {
  it("untranslatedPageReadsEnglish", async () => {
    const ui = await DocPage({ params: Promise.resolve({ locale: "it", page: "qumran" }) });
    render(ui, { locale: "it" });
    expect(loaded).toContain("en/qumran");
    expect(screen.getByText("The scrolls.").closest("article")).toHaveAttribute("lang", "en");
    expect(screen.getByRole("note")).toHaveTextContent("non è ancora disponibile in italiano");
    expect(screen.getByRole("link", { name: /Successiva: La Settanta/ })).toBeInTheDocument();
  });

  it("anEnglishPageHasNoNotice", async () => {
    render(await DocPage({ params: Promise.resolve({ locale: "en", page: "qumran" }) }));
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("anUnknownSlugIsNotFound", async () => {
    await expect(DocPage({ params: Promise.resolve({ locale: "en", page: "editions" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("everyLocaleAndPageIsPrerendered", () => {
    expect(generateStaticParams()).toHaveLength(102);
  });
});
