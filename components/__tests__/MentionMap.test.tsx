import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import type { MentionEntity } from "@/lib/types";

// Leaflet stands in for itself: the test sees what the map is asked to draw, not jsdom's lack of layout.
const leaflet = vi.hoisted(() => {
  const map = { setView: vi.fn(), remove: vi.fn() };
  const added = () => ({ addTo: vi.fn() });
  return {
    map,
    L: {
      map: vi.fn((_el: HTMLElement, _options: object) => map),
      tileLayer: vi.fn((_url: string, _options: object) => added()),
      circleMarker: vi.fn((_at: [number, number], _options: object) => added()),
    },
  };
});
vi.mock("leaflet", () => ({ default: leaflet.L }));

const { default: MentionMap } = await import("@/components/MentionMap");
const { MentionCard } = await import("@/components/MentionCard");

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {ui}
  </NextIntlClientProvider>
);
const place = (id: string, la: string, extra: Partial<MentionEntity> = {}): MentionEntity => ({
  id, type: "place", kind: "city", names: { la }, description: {}, uncertain: false, verseCount: 2, ...extra,
});
const nv = { sigla: "NVBSE", lang: "la" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MentionMap", () => {
  it("drawsTheSiteOnEsriStreetTilesAtZoom8WithOnlyTheZoomButtons", async () => {
    render(wrap(<MentionMap lat={31.7} lon={35.2} label="Map of Bethlehem" uncertain={false} />));
    await waitFor(() => expect(leaflet.map.setView).toHaveBeenCalledWith([31.7, 35.2], 8));
    const options = leaflet.L.map.mock.calls[0][1];
    expect(options).toMatchObject({ dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false, attributionControl: false });
    expect(options).not.toHaveProperty("zoomControl", false);
    expect(leaflet.L.tileLayer.mock.calls[0][0]).toContain("arcgisonline.com/ArcGIS/rest/services/World_Street_Map");
    expect(leaflet.L.circleMarker.mock.calls[0][0]).toEqual([31.7, 35.2]);
    expect(screen.getByRole("group", { name: "Map of Bethlehem" })).toBeInTheDocument();
    expect(screen.queryByText("site uncertain")).toBeNull();
  });

  it("creditsEsriCompactlyAndInFullOnRequest", () => {
    render(wrap(<MentionMap lat={1} lon={2} label="Map" uncertain={false} />));
    expect(screen.getByText("© Esri")).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Map credits" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "OpenStreetMap" })).toHaveAttribute("target", "_blank");
  });

  it("labelsAnUncertainSite", () => {
    render(wrap(<MentionMap lat={1} lon={2} label="Map" uncertain />));
    expect(screen.getByText("site uncertain")).toBeInTheDocument();
  });

  it("removesTheMapWhenTheCardCloses", async () => {
    const { unmount } = render(wrap(<MentionMap lat={1} lon={2} label="Map" uncertain={false} />));
    await waitFor(() => expect(leaflet.map.setView).toHaveBeenCalled());
    unmount();
    expect(leaflet.map.remove).toHaveBeenCalled();
  });
});

describe("the card's map", () => {
  it("loadsTheMapOnlyForAPlaceWithCoords", async () => {
    const entities: Record<string, MentionEntity> = {
      "bloc:bethlehem": place("bloc:bethlehem", "Bethlehem", { coords: { lat: 31.7, lon: 35.2 } }),
      "bloc:nusquam": place("bloc:nusquam", "Nusquam"),
      // Never a map for a person, whatever the data says.
      "bpers:petrus": { id: "bpers:petrus", type: "person", kind: "individual", names: { la: "Petrus" }, description: {}, uncertain: false, verseCount: 1, coords: { lat: 3, lon: 4 } },
    };
    const { unmount } = render(wrap(<MentionCard mark={{ entry: "bloc:bethlehem", ...nv }} entities={entities} locale="en" />));
    expect(await screen.findByRole("group", { name: "Map of Bethlehem" })).toBeInTheDocument();
    await waitFor(() => expect(leaflet.L.map).toHaveBeenCalledTimes(1));
    unmount();
    vi.clearAllMocks();

    render(wrap(<MentionCard mark={{ candidates: ["bloc:nusquam", "bpers:petrus"], ...nv }} entities={entities} locale="en" />));
    expect(screen.getByText("Nusquam")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("group", { name: /^Map of/ })).toBeNull();
    expect(leaflet.L.map).not.toHaveBeenCalled();
  });

  it("showsAnUncertainPlacesMapWithTheLabel", async () => {
    const entities = { "bloc:x": place("bloc:x", "Xanadu", { coords: { lat: 1, lon: 2 }, uncertain: true }) };
    render(wrap(<MentionCard mark={{ entry: "bloc:x", ...nv }} entities={entities} locale="en" />));
    expect(await screen.findByText("site uncertain")).toBeInTheDocument();
  });
});
