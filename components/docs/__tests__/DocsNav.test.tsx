import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@/test/intl";

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/docs/qumran" } }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => pathname.current,
  Link: ({ href, children, ...p }: { href: string; children?: React.ReactNode }) => <a href={href} {...p}>{children}</a>,
}));

import { DocsNav } from "@/components/docs/DocsNav";

describe("DocsNav", () => {
  it("listsBothPartsAndMarksTheCurrentPage", () => {
    pathname.current = "/docs/qumran";
    render(<DocsNav />);
    expect(screen.getByText("The Bible and its text")).toBeInTheDocument();
    expect(screen.getByText("Manuscripts and traditions")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "The Qumran scrolls" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "The Qumran scrolls" })).toHaveAttribute("href", "/docs/qumran");
    expect(screen.getByRole("link", { name: "The Septuagint" })).not.toHaveAttribute("aria-current");
  });

  it("namesThePagesInTheInterfaceLanguageAndMarksTheIndex", () => {
    pathname.current = "/docs";
    render(<DocsNav />, { locale: "it" });
    expect(screen.getByRole("link", { name: "Documentazione" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "I rotoli di Qumran" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Indice" })).toBeInTheDocument();
  });

  it("opensAndClosesTheContentsOnPhones", () => {
    pathname.current = "/docs/vulgate";
    render(<DocsNav />);
    const button = screen.getByRole("button", { name: "Contents" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });
});
