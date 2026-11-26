import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/intl";
import { PsalmNumber } from "@/components/PsalmNumber";

describe("PsalmNumber", () => {
  it("showsTheOtherNumberAndExplainsIt", () => {
    render(<PsalmNumber note="(23)" />);
    expect(screen.getByText("(23)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Why are the Psalms numbered two ways?" })).toHaveAttribute("href", "/en/docs/why-editions-differ#psalm-numbering");
  });

  it("showsNothingWhereTheNumbersAgree", () => {
    const { container } = render(<PsalmNumber note={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
