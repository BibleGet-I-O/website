import { Fragment, type ReactNode } from "react";

/**
 * Renders a verse's formatted `text` as React elements, a port of the endpoint's
 * `src/Util/FormattedText.php`. Only matched pairs of the known tags (the wiki's Database Schema page,
 * "Allowed markup in `text`") become markup; unknown tags, tags with attributes, unmatched or mismatched
 * tags and a lone `<` (`a < b`) stay literal text. React escapes every text node, so nothing in `text`
 * can become live HTML.
 *
 * Line tags wrap one line each (`<span class="bg-line bg-{tag}">`, block-level in the reader stylesheet);
 * `sm` and `speaker` become `<span class="bg-{tag}">`, `i` and `sup` are kept. Lines are separated by
 * `\n` and no pair spans one; an untagged line of a multi-line text (a psalm superscription, a prose
 * lead-in) becomes its own `bg-line bg-plain` line.
 */

const LINE_TAGS = new Set(["po", "pof", "pol", "poi", "poil", "poif", "pos", "po3", "po3l", "pr", "bq", "bqf", "bql"]);
const INLINE_TAGS = new Set(["sm", "i", "sup", "speaker"]);
/** Indented line tags: a verse number starting one hangs in the indent. `pr` (prose) has none. */
const HANGING = new Set([...LINE_TAGS].filter((t) => t !== "pr"));
/** Marks where mid-verse headings go (a private-use code point, removed from the text first). */
const MARKER = "";

type Node = { k: "text"; s: string } | { k: "el"; tag: string; children: Node[] };
type Raw = { k: "open" | "close"; tag: string; raw: string };
type Tok = Node | Raw;
const isRaw = (t: Tok): t is Raw => t.k === "open" || t.k === "close";

function tokenize(line: string): Tok[] {
  const toks: Tok[] = [];
  const re = /<(\/?)([a-z0-9]+)>/g;
  let last = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    const tag = m[2];
    if (!LINE_TAGS.has(tag) && !INLINE_TAGS.has(tag)) continue;
    if (m.index > last) toks.push({ k: "text", s: line.slice(last, m.index) });
    toks.push({ k: m[1] ? "close" : "open", tag, raw: m[0] });
    last = re.lastIndex;
  }
  if (last < line.length) toks.push({ k: "text", s: line.slice(last) });
  return toks;
}

/**
 * Innermost pairs first, until nothing changes, as FormattedText.php does: an opening tag pairs with the
 * next known tag only if that is its own closing tag. Whatever is left unpaired is literal text.
 */
function parseLine(line: string): Node[] {
  const toks = tokenize(line);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < toks.length; i++) {
      const open = toks[i];
      if (open.k !== "open") continue;
      let j = i + 1;
      while (j < toks.length && toks[j].k !== "open" && toks[j].k !== "close") j++;
      const close = toks[j];
      if (close && close.k === "close" && close.tag === open.tag) {
        toks.splice(i, j - i + 1, { k: "el", tag: open.tag, children: toks.slice(i + 1, j) as Node[] });
        changed = true;
      }
    }
  }
  const nodes: Node[] = [];
  for (const t of toks) {
    const n: Node = isRaw(t) ? { k: "text", s: t.raw } : t.k === "text" ? { ...t } : t;
    const prev = nodes[nodes.length - 1];
    if (n.k === "text" && prev?.k === "text") prev.s += n.s;
    else nodes.push(n);
  }
  return nodes;
}

const isLine = (n: Node | undefined): n is Extract<Node, { k: "el" }> => n?.k === "el" && LINE_TAGS.has(n.tag);
const isBlank = (n: Node) => n.k === "text" && /^\s*$/.test(n.s);

/** The text's lines; whitespace around line tags is dropped, so a `\n` between tagged lines adds nothing. */
function parse(text: string): { nodes: Node[]; plain: boolean }[] {
  const lines = text.split("\n");
  const out: { nodes: Node[]; plain: boolean }[] = [];
  for (const line of lines) {
    let nodes = parseLine(line);
    const tagged = nodes.some(isLine);
    // Only whitespace next to a line tag goes: `<i>a</i> <sm>b</sm>` keeps its space.
    if (tagged) nodes = nodes.filter((n, i, all) => !(isBlank(n) && (isLine(all[i - 1]) || isLine(all[i + 1]))));
    if (nodes.length === 0 || nodes.every(isBlank)) continue;
    out.push({ nodes, plain: !tagged && lines.length > 1 });
  }
  return out;
}

type Opts = { marker?: ReactNode; lead?: ReactNode };

function renderText(s: string, opts: Opts, key: string): ReactNode {
  if (!s.includes(MARKER)) return s;
  return s.split(MARKER).map((part, i) => (
    <Fragment key={`${key}.${i}`}>
      {i > 0 && opts.marker}
      {part}
    </Fragment>
  ));
}

function renderNodes(nodes: Node[], opts: Opts, key: string, lead?: ReactNode): ReactNode[] {
  return nodes.map((n, i) => {
    const k = `${key}.${i}`;
    if (n.k === "text") return <Fragment key={k}>{renderText(n.s, opts, k)}</Fragment>;
    const children = renderNodes(n.children, opts, k);
    if (LINE_TAGS.has(n.tag)) {
      const first = n.children.find((c) => !isBlank(c));
      const speaker = first?.k === "el" && first.tag === "speaker" ? " bg-has-speaker" : "";
      return (
        <span key={k} className={`bg-line bg-${n.tag}${speaker}`}>
          {i === 0 && lead}
          {children}
        </span>
      );
    }
    if (n.tag === "i") return <i key={k}>{children}</i>;
    if (n.tag === "sup") return <sup key={k}>{children}</sup>;
    return (
      <span key={k} className={`bg-${n.tag}`}>
        {children}
      </span>
    );
  });
}

function renderParsed(lines: { nodes: Node[]; plain: boolean }[], opts: Opts): ReactNode {
  return lines.map((line, i) => {
    // The lead (a verse number) goes inside the first node when that is a line, otherwise before it.
    const lead = i === 0 ? opts.lead : undefined;
    const leadInside = lead !== undefined && (line.plain || isLine(line.nodes[0]));
    const nodes = renderNodes(line.nodes, opts, String(i), leadInside && !line.plain ? lead : undefined);
    if (line.plain) {
      return (
        <span key={i} className="bg-line bg-plain">
          {lead}
          {nodes}
        </span>
      );
    }
    return (
      <Fragment key={i}>
        {!leadInside && lead}
        {nodes}
      </Fragment>
    );
  });
}

/** A verse's formatted text as React elements. */
export function renderFormatted(text: string): ReactNode {
  return renderParsed(parse(text), {});
}

const defaultHeadingClass = (j: number) =>
  j === 0 ? "mt-6 mb-2 block text-xl font-semibold" : "mb-2 block text-base font-semibold italic";

const labelClass = "font-sans text-xs text-slate-500 dark:text-slate-400";

/**
 * One verse: its number, its text, and its mid-verse headings.
 *
 * A verse that opens with an indented poetic line gets its number inside that line, hanging in the indent
 * (the WordPress plugin's `shortcode.js` does the same by outdenting the line); a prose verse keeps the
 * number inline before the text. Leading whitespace is dropped.
 *
 * `titles` are placed here only when `titlePosition` is set: a 0-based offset into `text` in code points,
 * tags included, and the verse reads `text[:pos]` + headings + `text[pos:]`. With no position the caller
 * prints the headings before the verse.
 */
export function renderVerse({ label, text, titles = [], titlePosition = null, headingClass = defaultHeadingClass }: {
  label: string | null;
  text: string;
  titles?: string[];
  titlePosition?: number | null;
  headingClass?: (j: number) => string;
}): ReactNode {
  let marked = text.replaceAll(MARKER, "");
  let marker: ReactNode;
  if (titlePosition != null && titlePosition > 0 && titles.length > 0) {
    const cps = Array.from(marked);
    marked = cps.slice(0, titlePosition).join("") + MARKER + cps.slice(titlePosition).join("");
    marker = titles.map((t, j) => (
      <span key={`h${j}`} role="heading" aria-level={2} className={headingClass(j)}>
        {t}
      </span>
    ));
  }
  const lines = parse(marked.trimStart());
  const first = lines[0]?.nodes[0];
  const hang = !lines[0]?.plain && first?.k === "el" && HANGING.has(first.tag);
  // The hanging number is spaced by its padding (app/globals.css), so "12:1" still fits the indent.
  const lead = label ? <sup className={hang ? `${labelClass} bg-vnum-hang` : `${labelClass} mr-0.5`}>{label}</sup> : undefined;
  return renderParsed(lines, { marker, lead });
}
