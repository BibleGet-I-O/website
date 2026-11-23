import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

const push = vi.fn();
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<object>("next/navigation")),
  useRouter: () => ({ push }),
}));
const { ReaderBar } = await import("@/components/ReaderBar");

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {ui}
  </NextIntlClientProvider>
);
const editions = [
  { sigla: "NABRE", fullname: "New American Bible" },
  { sigla: "DRB", fullname: "Douay-Rheims" },
  { sigla: "CEI2008", fullname: "Conferenza Episcopale Italiana" },
  { sigla: "VGCL", fullname: "Vulgata Clementina" },
];
const books = [
  { slug: "tobit", name: "Tobit", chapters: 14, bookNum: 17 },
  { slug: "esther", name: "Esther", chapters: 10, bookNum: 19 },
];
const props = {
  locale: "en", edition: "NABRE", editions, books, book: "tobit", bookNum: 17, chapter: 3,
  withSiglas: [] as string[], view: "side-by-side" as const, esther: false,
};
const openGoTo = () => fireEvent.click(screen.getByRole("button", { name: /Go to another book or chapter/ }));
const openMenu = () => fireEvent.click(screen.getByRole("button", { name: "Reading settings" }));
const item = (name: string | RegExp) => screen.getByRole("button", { name });
const pick = (value: string) => {
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByRole("combobox"), { target: { value } });
};
const offered = () =>
  Array.from((within(screen.getByRole("dialog")).getByRole("combobox") as HTMLSelectElement).options).map((o) => o.value).filter(Boolean);

beforeEach(() => push.mockReset());

describe("ReaderBar", () => {
  it("toolbarHasNoInterlinearCheckboxOrSecondSelect", () => {
    render(wrap(<ReaderBar {...props} withSiglas={["DRB"]} />));
    expect(screen.queryByLabelText("Interlinear")).toBeNull();
    expect(screen.queryByLabelText("Second edition")).toBeNull();
  });

  it("toolbarHasTheEditionSelectAndTheGoToButton", () => {
    render(wrap(<ReaderBar {...props} />));
    expect(screen.getAllByRole("combobox").map((c) => c.id)).toEqual(["rb-edition"]);
    const go = screen.getByRole("button", { name: /Go to another book or chapter/ });
    expect(go).toHaveTextContent("Tobit 3");
    expect(go).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("panelJumpsKeepTheComparedEditionsAndView", () => {
    render(wrap(<ReaderBar {...props} withSiglas={["DRB", "VGCL"]} view="interlinear" />));
    openGoTo();
    const four = screen.getByRole("link", { name: "4" });
    expect(four).toHaveAttribute("href", "/en/read/nabre/tobit/4?with=DRB,VGCL&view=interlinear");
    fireEvent.click(four);
    expect(push).toHaveBeenLastCalledWith("/en/read/nabre/tobit/4?with=DRB,VGCL&view=interlinear");
    openGoTo();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("link", { name: "Esther" }));
    expect(screen.getByRole("link", { name: "1" })).toHaveAttribute("href", "/en/read/nabre/esther/1?with=DRB,VGCL&view=interlinear");
    fireEvent.click(screen.getByRole("link", { name: "1" }));
    expect(push).toHaveBeenLastCalledWith("/en/read/nabre/esther/1?with=DRB,VGCL&view=interlinear");
  });

  it("panelKeepsEstherTraditionOnlyWithinEsther", () => {
    render(wrap(<ReaderBar {...props} book="esther" bookNum={19} chapter={1} esther tradition="HEBREW" withSiglas={["DRB"]} />));
    openGoTo();
    fireEvent.click(screen.getByRole("link", { name: "2" }));
    expect(push).toHaveBeenLastCalledWith("/en/read/nabre/esther/2?with=DRB&tradition=HEBREW");
    openGoTo();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("link", { name: "Tobit" }));
    fireEvent.click(screen.getByRole("link", { name: "1" }));
    expect(push).toHaveBeenLastCalledWith("/en/read/nabre/tobit/1?with=DRB");
  });

  it("anotherEditionOpensOnTheSameBookAndChapterByNumber", () => {
    render(wrap(<ReaderBar {...props} withSiglas={["CEI2008"]} view="interlinear" />));
    fireEvent.change(screen.getByLabelText("Edition"), { target: { value: "DRB" } });
    expect(push).toHaveBeenLastCalledWith("/en/read/drb?book=17&chapter=3&with=CEI2008&view=interlinear");
  });

  it("switchingMainEditionDropsItFromWithAndKeepsTheOther", () => {
    render(wrap(<ReaderBar {...props} book="esther" bookNum={19} chapter={1} esther tradition="HEBREW" withSiglas={["DRB", "VGCL"]} />));
    fireEvent.change(screen.getByLabelText("Edition"), { target: { value: "DRB" } });
    expect(push).toHaveBeenLastCalledWith("/en/read/drb?book=19&chapter=1&with=VGCL&tradition=HEBREW");
  });

  it("singleEditionMenuOffersOnlyCompare", () => {
    render(wrap(<ReaderBar {...props} />));
    expect(screen.queryByRole("button", { name: /Compare with another edition/ })).toBeNull();
    openMenu();
    expect(item(/Compare with another edition/)).toBeInTheDocument();
    for (const name of [/Change second/, /Add a third/, /Remove the third/, /Stop comparing/]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    expect(screen.queryByLabelText("Interlinear")).toBeNull();
  });

  it("choosingAnEditionInThePopupComparesWithIt", () => {
    render(wrap(<ReaderBar {...props} />));
    openMenu();
    fireEvent.click(item(/Compare with another edition/));
    expect(screen.getByRole("dialog", { name: "Second edition" })).toBeInTheDocument();
    expect(offered()).toEqual(["DRB", "CEI2008", "VGCL"]);
    pick("CEI2008");
    expect(push).toHaveBeenLastCalledWith("/en/read/nabre/tobit/3?with=CEI2008");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("addThirdAppendsToWith", () => {
    render(wrap(<ReaderBar {...props} withSiglas={["CEI2008"]} />));
    openMenu();
    fireEvent.click(item(/Add a third edition/));
    expect(screen.getByRole("dialog", { name: "Third edition" })).toBeInTheDocument();
    pick("VGCL");
    expect(push).toHaveBeenLastCalledWith("/en/read/nabre/tobit/3?with=CEI2008,VGCL");
  });

  it("popupNeverOffersTheMainOrTheOtherSlotEdition", () => {
    render(wrap(<ReaderBar {...props} withSiglas={["CEI2008", "VGCL"]} />));
    openMenu();
    fireEvent.click(item(/Change second edition/));
    expect(offered()).toEqual(["DRB", "CEI2008"]);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(item(/Change third edition/));
    expect(offered()).toEqual(["DRB", "VGCL"]);
  });

  it("changeSecondReplacesOnlyTheSecond", () => {
    render(wrap(<ReaderBar {...props} withSiglas={["CEI2008", "VGCL"]} view="interlinear" />));
    openMenu();
    fireEvent.click(item(/Change second edition/));
    pick("DRB");
    expect(push).toHaveBeenLastCalledWith("/en/read/nabre/tobit/3?with=DRB,VGCL&view=interlinear");
  });

  it("removeThirdKeepsTheSecond", () => {
    render(wrap(<ReaderBar {...props} withSiglas={["CEI2008", "VGCL"]} />));
    openMenu();
    expect(screen.queryByRole("button", { name: /Add a third/ })).toBeNull();
    fireEvent.click(item(/Remove the third edition/));
    expect(push).toHaveBeenLastCalledWith("/en/read/nabre/tobit/3?with=CEI2008");
  });

  it("interlinearSwitchSetsTheView", () => {
    const { unmount } = render(wrap(<ReaderBar {...props} withSiglas={["CEI2008"]} />));
    openMenu();
    expect(screen.getByLabelText("Interlinear")).not.toBeChecked();
    fireEvent.click(screen.getByLabelText("Interlinear"));
    expect(push).toHaveBeenLastCalledWith("/en/read/nabre/tobit/3?with=CEI2008&view=interlinear");
    unmount();
    render(wrap(<ReaderBar {...props} withSiglas={["CEI2008"]} view="interlinear" />));
    openMenu();
    expect(screen.getByLabelText("Interlinear")).toBeChecked();
    fireEvent.click(screen.getByLabelText("Interlinear"));
    expect(push).toHaveBeenLastCalledWith("/en/read/nabre/tobit/3?with=CEI2008");
  });

  it("stopComparingClearsWithAndView", () => {
    render(wrap(<ReaderBar {...props} withSiglas={["CEI2008", "VGCL"]} view="interlinear" />));
    openMenu();
    fireEvent.click(item(/Stop comparing/));
    expect(push).toHaveBeenLastCalledWith("/en/read/nabre/tobit/3");
  });

  it("menuClosesOnEscapeAndOutsideClick", () => {
    render(wrap(<><ReaderBar {...props} /><p>outside</p></>));
    const button = screen.getByRole("button", { name: "Reading settings" });
    openMenu();
    expect(button).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
    openMenu();
    fireEvent.pointerDown(screen.getByText("outside"));
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("escapeClosesThePopupFirst", () => {
    render(wrap(<ReaderBar {...props} />));
    openMenu();
    fireEvent.click(item(/Compare with another edition/));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("switchingEditionBuildsOnAViewStillOnItsWay", () => {
    render(wrap(<ReaderBar {...props} book="esther" bookNum={19} chapter={3} esther />));
    fireEvent.click(screen.getByRole("button", { name: "Reading settings" }));
    fireEvent.click(screen.getByLabelText("Interlinear"));
    // The interlinear page has not arrived yet: the edition switch still carries the view.
    fireEvent.change(screen.getByLabelText("Edition"), { target: { value: "DRB" } });
    expect(push).toHaveBeenLastCalledWith("/en/read/drb?book=19&chapter=3&view=interlinear");
  });

  it("aViewAskedFromAPageLeftBehindIsNotRevivedByComingBack", () => {
    const esther = { ...props, book: "esther", bookNum: 19, chapter: 3, esther: true };
    const { rerender } = render(wrap(<ReaderBar {...esther} />));
    fireEvent.click(screen.getByRole("button", { name: "Reading settings" }));
    fireEvent.click(screen.getByLabelText("Interlinear"));
    // The interlinear page arrives, then Back returns to the side-by-side one.
    rerender(wrap(<ReaderBar {...esther} view="interlinear" />));
    rerender(wrap(<ReaderBar {...esther} />));
    fireEvent.change(screen.getByLabelText("Edition"), { target: { value: "DRB" } });
    expect(push).toHaveBeenLastCalledWith("/en/read/drb?book=19&chapter=3");
  });

  it("switchingToTheComparedEditionKeepsTheViewForEsthersTwoTexts", () => {
    // DRB prints Esther once; NABRE, compared with it, prints both texts: the chapter page decides.
    render(wrap(<ReaderBar {...props} edition="DRB" book="esther" bookNum={19} chapter={1} withSiglas={["NABRE"]} view="interlinear" />));
    fireEvent.change(screen.getByLabelText("Edition"), { target: { value: "NABRE" } });
    expect(push).toHaveBeenLastCalledWith("/en/read/nabre?book=19&chapter=1&view=interlinear");
  });

  it("switchingEditionFromEstherReadAloneKeepsTheView", () => {
    render(wrap(<ReaderBar {...props} book="esther" bookNum={19} chapter={3} esther view="interlinear" />));
    fireEvent.change(screen.getByLabelText("Edition"), { target: { value: "DRB" } });
    expect(push).toHaveBeenLastCalledWith("/en/read/drb?book=19&chapter=3&view=interlinear");
  });

  it("theMenuHasNoEstherTextAndOffersInterlinearForTheTwoTexts", () => {
    const { unmount } = render(wrap(<ReaderBar {...props} book="esther" bookNum={19} chapter={1} esther />));
    openMenu();
    expect(screen.queryByLabelText("Esther text")).toBeNull();
    fireEvent.click(screen.getByLabelText("Interlinear"));
    expect(push).toHaveBeenLastCalledWith("/en/read/nabre/esther/1?view=interlinear");
    unmount();
    render(wrap(<ReaderBar {...props} book="esther" bookNum={19} chapter={1} />));
    openMenu();
    expect(screen.queryByLabelText("Interlinear")).toBeNull();
  });

  it("aSingleEditionSiteHasNothingToCompare", () => {
    render(wrap(<ReaderBar {...props} editions={editions.slice(0, 1)} />));
    openMenu();
    expect(item(/Compare with another edition/)).toBeDisabled();
  });

  it("thePopupReplacesTheMenuItemsAndCancelReturnsFocusToTheItem", () => {
    render(wrap(<ReaderBar {...props} withSiglas={["CEI2008"]} />));
    openMenu();
    fireEvent.click(item(/Add a third edition/));
    const dialog = screen.getByRole("dialog");
    expect(dialog).not.toHaveAttribute("aria-modal");
    // Nothing behind the popup to tab to: the menu items give way to it.
    expect(screen.queryByRole("button", { name: /Stop comparing/ })).toBeNull();
    expect(screen.queryByLabelText("Interlinear")).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(item(/Add a third edition/)).toHaveFocus();
    fireEvent.click(item(/Change second edition/));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(item(/Change second edition/)).toHaveFocus();
  });

  it("theMenuClosesWhenTheReaderMovesOn", () => {
    const { rerender } = render(wrap(<ReaderBar {...props} withSiglas={["CEI2008"]} />));
    openMenu();
    fireEvent.click(screen.getByLabelText("Interlinear"));
    rerender(wrap(<ReaderBar {...props} withSiglas={["CEI2008"]} view="interlinear" />));
    expect(screen.getByRole("button", { name: "Reading settings" })).toHaveAttribute("aria-expanded", "false");
    openMenu();
    rerender(wrap(<ReaderBar {...props} chapter={4} withSiglas={["CEI2008"]} view="interlinear" />));
    expect(screen.getByRole("button", { name: "Reading settings" })).toHaveAttribute("aria-expanded", "false");
  });

  it("theButtonControlsThePanelOnlyWhileItIsOpen", () => {
    render(wrap(<ReaderBar {...props} />));
    const button = screen.getByRole("button", { name: "Reading settings" });
    expect(button).not.toHaveAttribute("aria-controls");
    openMenu();
    expect(document.getElementById(button.getAttribute("aria-controls")!)).not.toBeNull();
  });

  it("onANarrowScreenTheEditionShowsAsItsSiglaOverTheFullNamePicker", () => {
    render(wrap(<ReaderBar {...props} />));
    const select = screen.getByLabelText("Edition");
    // The picker still lists the full names; below sm it is transparent over the sigla.
    expect(select).toHaveValue("NABRE");
    expect((select as HTMLSelectElement).selectedOptions[0].textContent).toBe("New American Bible");
    expect(select).toHaveClass("max-sm:absolute", "max-sm:inset-0", "max-sm:opacity-0");
    const short = screen.getByTestId("edition-sigla");
    expect(short).toHaveTextContent("NABRE");
    expect(short).toHaveAttribute("aria-hidden", "true");
    expect(short).toHaveClass("sm:hidden");
    // One line below sm: the go-to button gives way (shrinks) before anything wraps.
    expect(screen.getByRole("toolbar")).toHaveClass("flex-nowrap", "sm:flex-wrap");
    expect(screen.getByRole("button", { name: /Go to another book or chapter/ })).toHaveClass("min-w-0", "max-sm:flex-1");
  });

  it("aSecondActionBeforeTheNewPageArrivesKeepsTheFirstOnesChange", () => {
    // The Interlinear toggle starts a navigation; the props still say side by side when the third is added.
    render(wrap(<ReaderBar {...props} withSiglas={["CEI2008"]} />));
    openMenu();
    fireEvent.click(screen.getByLabelText("Interlinear"));
    expect(push).toHaveBeenLastCalledWith("/en/read/nabre/tobit/3?with=CEI2008&view=interlinear");
    fireEvent.click(item(/Add a third edition/));
    pick("VGCL");
    expect(push).toHaveBeenLastCalledWith("/en/read/nabre/tobit/3?with=CEI2008,VGCL&view=interlinear");
  });
  it("comparingSearchesTheFirstEdition", () => {
    const { container } = render(wrap(<ReaderBar {...props} withSiglas={["DRB"]} />));
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    const form = container.querySelector("form[role=search]")!;
    expect(form).toHaveAttribute("action", "/en/read/nabre/search");
    expect(form.querySelector("input[name=from]")).toHaveAttribute("value", "/en/read/nabre/tobit/3?with=DRB");
  });

  it("theSearchPanelOpensBelowTheToolbar", () => {
    render(wrap(<ReaderBar {...props} />));
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    const toolbar = screen.getByRole("toolbar");
    expect(toolbar.querySelector("form[role=search]")).toBeNull();
    expect(toolbar.nextElementSibling?.querySelector("form[role=search]")).toBeTruthy();
  });

  it("theWayBackKeepsTheComparison", () => {
    const { container } = render(wrap(<ReaderBar {...props} withSiglas={["DRB"]} view="interlinear" />));
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(container.querySelector("form[role=search] input[name=from]")).toHaveAttribute("value", "/en/read/nabre/tobit/3?with=DRB&view=interlinear");
  });
});
