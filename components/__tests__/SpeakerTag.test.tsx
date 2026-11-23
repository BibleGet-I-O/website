import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { SpeakerTag } from "@/components/SpeakerTag";

const wrap = (ui: React.ReactNode) => <NextIntlClientProvider locale="en" messages={en}>{ui}</NextIntlClientProvider>;

describe("SpeakerTag", () => {
  it("theButtonCarriesTheMeaning", () => {
    render(wrap(<SpeakerTag tag="D?" />));
    const meaning = "probably the Daughters of Jerusalem (the attribution is uncertain)";
    const button = screen.getByRole("button", { name: `D?: ${meaning}` });
    expect(button).toHaveTextContent("D?");
    expect(button).toHaveClass("bg-speaker");
    expect(button).toHaveAttribute("title", meaning);
    const pop = document.getElementById(button.getAttribute("popovertarget")!)!;
    expect(pop).toHaveAttribute("popover", "auto");
    expect(pop).toHaveTextContent(meaning);
  });

  it("anUnknownTagStaysPlain", () => {
    const { container } = render(wrap(<SpeakerTag tag="X" />));
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector("span.bg-speaker")).toHaveTextContent("X");
  });

  it("eachTagHasItsOwnPopover", () => {
    render(wrap(<><SpeakerTag tag="W" /><SpeakerTag tag="W" /></>));
    const ids = screen.getAllByRole("button").map((b) => b.getAttribute("popovertarget"));
    expect(new Set(ids).size).toBe(2);
  });
});
