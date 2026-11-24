import { Fragment, type ReactNode } from "react";
import { NoteMarker } from "@/components/NoteMarker";
import { SpeakerTag } from "@/components/SpeakerTag";
import { markerDomId } from "@/lib/notes";
import type { NoteMarker as Marker } from "@/lib/types";

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
/**
 * Marks where something is inserted into the text: mid-verse headings (U+E000) and note markers (U+E001 on), private-use
 * code points removed from the text first.
 */
const MARKER = "";
const INSERTED = /[-]/g;
const SPLIT = /([-])/;

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

type Opts = { inserts?: Map<string, ReactNode>; lead?: ReactNode };

function renderText(s: string, opts: Opts, key: string): ReactNode {
  if (!opts.inserts?.size || !SPLIT.test(s)) return s;
  return s.split(SPLIT).map((part, i) => <Fragment key={`${key}.${i}`}>{i % 2 === 1 ? opts.inserts!.get(part) : part}</Fragment>);
}

/** An opening line tag at the start of `s`: an insertion there goes inside the line, after the tag. */
const LINE_OPEN = new RegExp(`^<(${[...LINE_TAGS].join("|")})>`);

/**
 * `text` with each insertion's private-use code point at its offset (code points, tags included); several at one
 * offset keep their order. A marker `intoLine` just before a line's opening tag moves after it, into the line.
 */
function withInserts(text: string, at: { pos: number; mark: string; intoLine?: boolean }[]): string {
  const cps = Array.from(text);
  const before = new Map<number, string>();
  for (const { pos, mark, intoLine } of at) {
    let p = Math.min(Math.max(pos, 0), cps.length);
    // A heading stays between lines; a note marker goes into the line it begins (past whitespace before it,
    // which the lines drop: many rows open with "\n").
    if (intoLine) {
      let q = p;
      while (q < cps.length && /\s/.test(cps[q])) q++;
      for (let m = LINE_OPEN.exec(cps.slice(q, q + 8).join("")); m; m = LINE_OPEN.exec(cps.slice(q, q + 8).join(""))) {
        q += m[0].length;
        p = q;
      }
    }
    before.set(p, (before.get(p) ?? "") + mark);
  }
  let out = "";
  for (let i = 0; i <= cps.length; i++) out += (before.get(i) ?? "") + (cps[i] ?? "");
  return out;
}

type Place = { chapter: number; verse: number; segment?: string | null; tradition?: string };

/** A note's marker in the text or a heading, its id built from the verse it is on. */
function markerNode(m: Marker, at: Place | undefined, key: string, verse?: string): ReactNode {
  return <NoteMarker key={key} note={m.note} id={at ? markerDomId(m.note.id, at) : ""} verse={verse} />;
}

/** A heading with the note markers printed in it (`field: "title"`, this heading's index). */
export function renderTitle(text: string, notes: Marker[] | undefined, titleIndex: number, at?: Place): ReactNode {
  const mine = (notes ?? []).filter((m) => m.field === "title" && m.titleIndex === titleIndex);
  if (mine.length === 0) return text;
  const inserts = new Map<string, ReactNode>();
  const marked = withInserts(
    text.replace(INSERTED, ""),
    mine.map((m, i) => {
      const mark = String.fromCodePoint(0xe001 + i);
      inserts.set(mark, markerNode(m, at, `t${i}`));
      return { pos: m.position ?? 0, mark, intoLine: true };
    }),
  );
  return renderText(marked, { inserts }, "t");
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
    // A speaker tag explains itself (who speaks; "?" = uncertain): its text is the label, as printed.
    if (n.tag === "speaker" && n.children.every((c) => c.k === "text")) {
      return <SpeakerTag key={k} tag={n.children.map((c) => (c.k === "text" ? c.s : "")).join("").trim()} />;
    }
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

// Verse numbers in rubric red, as the headings and edition names of a printed Bible.
const labelClass = "font-sans text-xs text-red-700 dark:text-red-400";

/**
 * One verse: its number, its text, and its mid-verse headings.
 *
 * A verse that opens with an indented poetic line gets its number inside that line, hanging in the indent
 * (the WordPress plugin's `shortcode.js` does the same by outdenting the line); a prose verse keeps the
 * number inline before the text. Leading whitespace is dropped.
 *
 * `titles` are placed here only when `titlePosition` is set: a 0-based offset into `text` in code points,
 * tags included, and the verse reads `text[:pos]` + headings + `text[pos:]`. With no position the caller
 * prints the headings before the verse. `headCol` makes them feed that column's running head (StickyHead).
 */
export function renderVerse({ label, text, titles = [], titlePosition = null, headingClass = defaultHeadingClass, headCol, notes = [], at }: {
  label: string | null;
  text: string;
  titles?: string[];
  titlePosition?: number | null;
  headingClass?: (j: number) => string;
  headCol?: number;
  /** The row's note markers (signed-in readers); those in its text go in, a whole-verse one marks the number. */
  notes?: Marker[];
  /** The verse, for the markers' ids (`m-{note}-v{chapter}.{verse}`), which the notes list links back to. */
  at?: Place;
}): ReactNode {
  const inserts = new Map<string, ReactNode>();
  const at_: { pos: number; mark: string; intoLine?: boolean }[] = [];
  if (titlePosition != null && titlePosition > 0 && titles.length > 0) {
    inserts.set(
      MARKER,
      titles.map((t, j) => (
        <span key={`h${j}`} role="heading" aria-level={2} data-head-col={headCol} data-head-text={headCol == null ? undefined : titles.at(-1)} className={headingClass(j)}>
          {renderTitle(t, notes, j, at)}
        </span>
      )),
    );
    at_.push({ pos: titlePosition, mark: MARKER });
  }
  const inText = notes.filter((m) => m.field === "text");
  const whole = inText.filter((m) => m.position === null);
  inText.forEach((m, i) => {
    // The first whole-verse note marks the number; any other is a marker at the start of the text.
    if (m === whole[0] && label) return;
    const mark = String.fromCodePoint(0xe001 + i);
    inserts.set(mark, markerNode(m, at, `n${i}`, label ?? undefined));
    at_.push({ pos: m.position ?? 0, mark, intoLine: true });
  });
  // Offsets count from the stored text, leading whitespace included; it is dropped afterwards.
  const marked = withInserts(text.replace(INSERTED, ""), at_).trimStart();
  const lines = parse(marked);
  const first = lines[0]?.nodes[0];
  const hang = !lines[0]?.plain && first?.k === "el" && HANGING.has(first.tag);
  // The hanging number is spaced by its padding (app/globals.css), so "12:1" still fits the indent.
  const number = whole[0] && label ? <NoteMarker note={whole[0].note} id={at ? markerDomId(whole[0].note.id, at) : ""}>{label}</NoteMarker> : label;
  const lead = label ? <sup className={hang ? `${labelClass} bg-vnum-hang` : `${labelClass} mr-0.5`}>{number}</sup> : undefined;
  return renderParsed(lines, { inserts, lead });
}
