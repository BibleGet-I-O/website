import { describe, it, expect } from "vitest";
import { useTranslations } from "next-intl";
import { render, screen } from "@/test/intl";

function Title({ n }: { n: number }) {
  const t = useTranslations("Docs");
  return <p>{t("index.title")} {n}</p>;
}

describe("the intl test helper", () => {
  it("keepsTheLocaleProviderOnRerender", () => {
    const { rerender } = render(<Title n={1} />, { locale: "it" });
    rerender(<Title n={2} />);
    expect(screen.getByText("Documentazione 2")).toBeInTheDocument();
  });
});
