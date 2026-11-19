const TAG = /^v\d+\.\d+\.\d+([-.][0-9A-Za-z.]+)?$/;
const SHA = /^[0-9a-f]{7,40}$/;
// `git describe --long` form: <tag>-<commits>-g<sha>
const DESCRIBE = /^(v\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)*)-\d+-g([0-9a-f]{7,40})$/;

export const ENDPOINT_REPO = "https://github.com/BibleGet-I-O/endpoint";
export const WEBSITE_REPO = "https://github.com/BibleGet-I-O/website";

export type VersionLink = { label: string; href: string | null };

/** What to show for the endpoint's reported version, and where to link it; no link unless the format is recognised. */
export function apiVersionLink(version: string): VersionLink {
  const describe = DESCRIBE.exec(version);
  if (describe) return { label: version, href: `${ENDPOINT_REPO}/commit/${describe[2]}` };
  if (SHA.test(version)) return { label: version.slice(0, 7), href: `${ENDPOINT_REPO}/commit/${version}` };
  if (TAG.test(version)) return { label: version, href: `${ENDPOINT_REPO}/releases/tag/${version}` };
  return { label: version, href: null };
}

/** The site's own version: its commit (7 characters, linked) when known, else the release id as plain text. */
export function siteVersionLink(commit: string, release: string): VersionLink {
  if (SHA.test(commit)) return { label: commit.slice(0, 7), href: `${WEBSITE_REPO}/commit/${commit}` };
  return { label: release, href: null };
}
