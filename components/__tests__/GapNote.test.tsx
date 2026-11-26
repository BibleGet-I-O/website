import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...p }: { href: string; children?: React.ReactNode }) => <a href={href} {...p}>{children}</a>,
}));

import { GapNote } from "@/components/GapNote";

describe("GapNote", () => {
  it("explainsTheGap", () => {
    render(<GapNote edition="New American Bible" />);
    expect(screen.getByText(/Not in New American Bible/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Why does this edition lack this verse?" })).toHaveAttribute("href", "/docs/why-editions-differ#missing-verses");
  });
});
