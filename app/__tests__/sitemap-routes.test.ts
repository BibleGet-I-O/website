import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
const getEditions = vi.fn();
const getIndex = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, getEditions: () => getEditions(), getIndex: (s: string) => getIndex(s) };
});
const { GET: index } = await import("@/app/sitemap.xml/route");
const { GET: edition } = await import("@/app/sitemaps/[file]/route");

const ed = (sigla: string) => ({ sigla, fullname: sigla, year: "", language: "en", canon: "", copyrightHolder: "", notes: "", copyright: false, liturgical: false });
const one = (file: string) => edition(new Request(`http://localhost/sitemaps/${file}`), { params: Promise.resolve({ file }) });

describe("sitemap routes", () => {
  beforeEach(() => {
    getEditions.mockResolvedValue([ed("NVBSE"), ed("DRB")]);
    getIndex.mockResolvedValue({ sigla: "NVBSE", books: [{ bookNum: 1, name: "Genesis", abbrev: "Gn", chapters: 2, versesPerChapter: [1, 1] }] });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("stagingServesNoSitemap", async () => {
    vi.stubEnv("SITE_CANONICAL_ORIGIN", "https://www.bibleget.io");
    vi.stubEnv("SITE_NOINDEX", "1");
    expect((await index()).status).toBe(404);
    expect((await one("nvbse.xml")).status).toBe(404);
  });

  it("noOriginServesNoSitemap", async () => {
    vi.stubEnv("SITE_CANONICAL_ORIGIN", "");
    vi.stubEnv("SITE_NOINDEX", "");
    expect((await index()).status).toBe(404);
  });

  it("productionServesTheIndexAndEachEdition", async () => {
    vi.stubEnv("SITE_CANONICAL_ORIGIN", "https://www.bibleget.io");
    vi.stubEnv("SITE_NOINDEX", "");
    const res = await index();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/xml");
    expect(await res.text()).toContain("<loc>https://www.bibleget.io/sitemaps/nvbse.xml</loc>");
    const ed1 = await one("nvbse.xml");
    expect(ed1.status).toBe(200);
    expect(await ed1.text()).toContain("<loc>https://www.bibleget.io/de/read/nvbse/genesis/2</loc>");
    expect((await one("unknown.xml")).status).toBe(404);
    expect((await one("nvbse")).status).toBe(404);
  });
});
