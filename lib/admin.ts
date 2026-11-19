import "server-only";

export type AdminVersion = {
  sigla: string;
  fullname: string;
  year: number;
  language: string;
  copyright: boolean;
  reader_full_text: boolean;
};

/** Absolute URL of an admin route on the endpoint, or null when BIBLEGET_API_URL is unset. */
export function adminUrl(path: string): string | null {
  const base = process.env.BIBLEGET_API_URL;
  return base ? `${base.replace(/\/+$/, "")}${path}` : null;
}
