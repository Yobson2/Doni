import { Injectable } from '@nestjs/common';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf';
import type {
  ParsedIndexValue,
  ParsedSecurityPrice,
  ParsedTradingDay,
  PriceDocumentParser,
} from '../prices/price-source';

/**
 * Reads a BOC PDF in the layout the BRVM has used since 2026 (the pre-2026
 * layout needs its own parser). It only reads: whether the figures make
 * sense is for the checks (boc-checks.ts).
 *
 * The layout, as printed:
 * - page 1: the date and bulletin number; the headline indices (BRVM
 *   COMPOSITE, BRVM 30, BRVM PRESTIGE) with their daily variation; then the
 *   tables of compartment, total-return and sector indices;
 * - from page 3: the share listing ("Marché des actions"), one block per
 *   compartment, each opened by a "COMPARTIMENT ..." line that repeats the
 *   compartment index, and closed by "TOTAL - MARCHE DES ACTIONS" with the
 *   day's total volume. A share row reads: symbol, title, previous close,
 *   open, close, variation, volume, value, reference price, ... A share that
 *   did not trade shows SP (suspended) or NC (not quoted) instead of its
 *   open and close, and no volume or value.
 */
@Injectable()
export class BocParser implements PriceDocumentParser {
  async parse(document: Uint8Array): Promise<ParsedTradingDay> {
    const pages = await readPages(document);
    if (pages.length === 0) throw new BocLayoutError('the PDF has no pages');
    const front = pages[0];
    const { tradingDate, reference } = readHeader(front);
    const { indices, repeated } = readIndices(front);
    const shares = readShares(pages.slice(1));
    return {
      tradingDate,
      reference,
      securities: shares.securities,
      indices,
      controls: {
        totalVolume: shares.totalVolume,
        repeatedIndexValues: [...repeated, ...shares.repeated],
      },
      unreadableRows: shares.unreadableRows,
    };
  }
}

/** The PDF is not a BOC in the layout this parser reads. */
export class BocLayoutError extends Error {
  constructor(detail: string) {
    super(`Not a BOC in the 2026 layout: ${detail}`);
    this.name = 'BocLayoutError';
  }
}

// ─── Text layout ─────────────────────────────────────────────

interface TextCell {
  x: number;
  y: number;
  text: string;
}

/** Cells that share a baseline: one printed line. */
interface Line {
  y: number;
  cells: TextCell[];
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f\u200b]/g;

/** Cells whose baselines are this close (PDF units) are one line. */
const SAME_LINE = 1.5;

async function readPages(document: Uint8Array): Promise<Line[][]> {
  // pdf.js takes ownership of the buffer it is given, so it gets a copy.
  const pdf = await getDocument({
    data: new Uint8Array(document),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  }).promise;
  try {
    const pages: Line[][] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      const cells: TextCell[] = [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        // Some cells hold only control characters (layout artefacts).
        const text = item.str.replace(CONTROL_CHARACTERS, '').trim();
        if (!text) continue;
        cells.push({ x: item.transform[4], y: item.transform[5], text });
      }
      pages.push(toLines(cells));
    }
    return pages;
  } finally {
    await pdf.destroy();
  }
}

/** Groups cells into lines, top of the page first, cells left to right. */
function toLines(cells: TextCell[]): Line[] {
  const sorted = [...cells].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  for (const cell of sorted) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line.y - cell.y) <= SAME_LINE) line.cells.push(cell);
    else lines.push({ y: cell.y, cells: [cell] });
  }
  for (const line of lines) line.cells.sort((a, b) => a.x - b.x);
  return lines;
}

const lineText = (line: Line) => line.cells.map((c) => c.text).join(' ');

// ─── Numbers ─────────────────────────────────────────────────

/**
 * A printed number as a decimal string: "13 000" -> "13000",
 * "-0,21 %" -> "-0.21". Null when the text is not a number.
 */
export function readNumber(text: string): string | null {
  const compact = text.replace(/[\s\u00a0\u202f%]/g, '').replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(compact) ? compact : null;
}

const isPercent = (text: string) => /%\s*$/.test(text);

// ─── Front page ──────────────────────────────────────────────

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

function readHeader(front: Line[]): {
  tradingDate: string;
  reference: string | null;
} {
  const text = front.map(lineText).join('\n');
  const date = new RegExp(
    `(\\d{1,2})(?:er)?\\s+(${MONTHS.join('|')})\\s+(\\d{4})`,
    'i',
  ).exec(text);
  if (!date) throw new BocLayoutError('no session date on the front page');
  const month = MONTHS.indexOf(date[2].toLowerCase()) + 1;
  const tradingDate = `${date[3]}-${pad(month)}-${pad(Number(date[1]))}`;
  const number = /N°\s*(\d+)/.exec(text);
  return { tradingDate, reference: number ? number[1] : null };
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Doni's code for each index the BOC prints, by its printed name with the
 * "BRVM" prefix, dashes and extra spaces removed.
 */
export const BOC_INDEX_CODES: Record<string, string> = {
  COMPOSITE: 'BRVM-C',
  '30': 'BRVM-30',
  PRESTIGE: 'BRVM-PRESTIGE',
  PRINCIPAL: 'BRVM-PRINCIPAL',
  'COMPOSITE TOTAL RETURN': 'BRVM-C-TR',
  TELECOMMUNICATIONS: 'BRVM-TEL',
  'SERVICES FINANCIERS': 'BRVM-FIN',
  'CONSOMMATION DISCRETIONNAIRE': 'BRVM-CD',
  'CONSOMMATION DE BASE': 'BRVM-CB',
  INDUSTRIELS: 'BRVM-IND',
  ENERGIE: 'BRVM-ENE',
  'SERVICES PUBLICS': 'BRVM-SPU',
};

function indexCode(printedName: string): string | null {
  const key = printedName
    .replace(FOOTNOTE_MARK, '')
    .toUpperCase()
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^BRVM\s*/, '');
  return BOC_INDEX_CODES[key] ?? null;
}

/** A footnote call printed after a name, e.g. "BRVM-PRINCIPAL (**)". */
const FOOTNOTE_MARK = /\(\*+\)/g;

const HEADLINE_INDICES = ['BRVM COMPOSITE', 'BRVM 30', 'BRVM PRESTIGE'];
/** Index tables start at this heading; the headline block sits above it. */
const INDEX_TABLES_HEADING = 'INDICES PAR COMPARTIMENT';
/** In the index tables, names sit left of this x and figures right of it. */
const INDEX_TABLE_FIGURES_X = 140;

function readIndices(front: Line[]): {
  indices: ParsedIndexValue[];
  repeated: { code: string; value: string; where: string }[];
} {
  const tablesAt = front.findIndex((l) =>
    lineText(l).startsWith(INDEX_TABLES_HEADING),
  );
  if (tablesAt < 0) {
    throw new BocLayoutError(`no "${INDEX_TABLES_HEADING}" on the front page`);
  }
  const indices = readHeadlineIndices(front.slice(0, tablesAt));
  const repeated: { code: string; value: string; where: string }[] = [];

  for (const line of front.slice(tablesAt + 1)) {
    if (!line.cells[0].text.startsWith('BRVM')) continue;
    const name = line.cells
      .filter((c) => c.x < INDEX_TABLE_FIGURES_X)
      .map((c) => c.text)
      .join(' ');
    const figures = line.cells
      .filter((c) => c.x >= INDEX_TABLE_FIGURES_X)
      .map((c) => c.text);
    const code = indexCode(name);
    // Figures: number of companies, value, daily variation, ...
    const value = figures[1] ? readNumber(figures[1]) : null;
    if (!code || !value) continue;
    const variation =
      figures[2] && isPercent(figures[2]) ? readNumber(figures[2]) : null;
    if (indices.some((i) => i.code === code)) {
      repeated.push({ code, value, where: 'index tables, front page' });
    } else {
      const printed = name.replace(FOOTNOTE_MARK, '').replace(/\s+/g, ' ');
      indices.push({ code, name: printed.trim(), value, variation });
    }
  }
  return { indices, repeated };
}

/**
 * The headline block: each index name with its value to its right, and a
 * "Variation Jour" line below whose percentages sit under the same names.
 */
function readHeadlineIndices(block: Line[]): ParsedIndexValue[] {
  const labels: { name: string; x: number; line: Line }[] = [];
  for (const line of block) {
    for (const cell of line.cells) {
      if (HEADLINE_INDICES.includes(cell.text)) {
        labels.push({ name: cell.text, x: cell.x, line });
      }
    }
  }
  if (labels.length === 0) {
    throw new BocLayoutError('no headline indices on the front page');
  }
  labels.sort((a, b) => a.x - b.x);
  const labelFor = (x: number) =>
    [...labels].reverse().find((label) => label.x <= x);

  const variations = new Map<string, string>();
  const dayLine = block.find(
    (l) =>
      l.cells[0].text === 'Variation Jour' &&
      l.cells.some((c) => isPercent(c.text)),
  );
  for (const cell of dayLine?.cells ?? []) {
    const label = isPercent(cell.text) ? labelFor(cell.x) : undefined;
    const value = readNumber(cell.text);
    if (label && value) variations.set(label.name, value);
  }

  const indices: ParsedIndexValue[] = [];
  for (const label of labels) {
    const next = label.line.cells.find((c) => c.x > label.x);
    const value = next ? readNumber(next.text) : null;
    const code = indexCode(label.name);
    if (!value || !code) {
      throw new BocLayoutError(`no value printed for ${label.name}`);
    }
    indices.push({
      code,
      name: label.name,
      value,
      variation: variations.get(label.name) ?? null,
    });
  }
  return indices;
}

// ─── Share listing ───────────────────────────────────────────

const SHARES_END = 'TOTAL - MARCHE DES ACTIONS';
/**
 * The symbol column lies between these x; the sector code, printed on its own
 * line under each row, sits left of it, and the title column starts at
 * TITLE_X.
 */
const SYMBOL_X = 30;
const TITLE_X = 60;
/** Figures start right of the title column. */
const FIGURES_X = 150;
/** BRVM symbols: upper-case letters, e.g. SNTS, CBIBF. */
const SYMBOL = /^[A-Z]{3,6}$/;
/** Printed instead of an open and close when a share did not trade. */
const NOT_TRADED = new Set(['SP', 'NC']);
/** A total's figures may sit a few units off its label's baseline. */
const TOTAL_LINE_TOLERANCE = 6;

function readShares(pages: Line[][]): {
  securities: ParsedSecurityPrice[];
  totalVolume: string | null;
  repeated: { code: string; value: string; where: string }[];
  unreadableRows: string[];
} {
  const securities: ParsedSecurityPrice[] = [];
  const repeated: { code: string; value: string; where: string }[] = [];
  const unreadableRows: string[] = [];
  let inShares = false;

  for (const lines of pages) {
    for (const line of lines) {
      const first = line.cells[0].text;
      if (first.startsWith('COMPARTIMENT')) {
        inShares = true;
        const code = indexCode(first.replace(/^COMPARTIMENT\s*/, ''));
        const value = line.cells[1] ? readNumber(line.cells[1].text) : null;
        if (code && value) {
          repeated.push({ code, value, where: 'share listing heading' });
        }
        continue;
      }
      if (!inShares) continue;
      if (lineText(line).startsWith(SHARES_END)) {
        return {
          securities,
          totalVolume: totalNear(lines, line),
          repeated,
          unreadableRows,
        };
      }
      const symbol = line.cells[0];
      if (symbol.x < SYMBOL_X || symbol.x >= TITLE_X) continue;
      if (!SYMBOL.test(symbol.text)) continue;
      if (symbol.text === 'TOTAL') continue;
      const row = readShareRow(line);
      if (row) securities.push(row);
      else unreadableRows.push(lineText(line));
    }
  }
  if (securities.length === 0) {
    throw new BocLayoutError('no share listing found');
  }
  return { securities, totalVolume: null, repeated, unreadableRows };
}

function readShareRow(line: Line): ParsedSecurityPrice | null {
  const ticker = line.cells[0].text;
  const name = line.cells
    .filter((c) => c.x >= TITLE_X && c.x < FIGURES_X)
    .map((c) => c.text)
    .join(' ');
  const f = line.cells.filter((c) => c.x >= FIGURES_X).map((c) => c.text);
  const previousClose = f[0] ? readNumber(f[0]) : null;
  if (!previousClose || !f[3] || !isPercent(f[3])) return null;
  const variation = readNumber(f[3]);

  if (NOT_TRADED.has(f[1]) && NOT_TRADED.has(f[2])) {
    // Figures: previous, SP/NC, SP/NC, variation, reference price, ...
    const reference = f[4] ? readNumber(f[4]) : null;
    if (!reference) return null;
    return {
      ticker,
      name,
      previousClose,
      open: null,
      close: reference,
      volume: null,
      value: null,
      variation,
      traded: false,
    };
  }

  // Figures: previous, open, close, variation, volume, value, reference, ...
  const [open, close, volume, value] = [f[1], f[2], f[4], f[5]].map((t) =>
    t ? readNumber(t) : null,
  );
  if (!open || !close || !volume || !value) return null;
  return {
    ticker,
    name,
    previousClose,
    open,
    close,
    volume,
    value,
    variation,
    traded: true,
  };
}

/** The first figure printed on, or just beside, a total's label line. */
function totalNear(lines: Line[], label: Line): string | null {
  const figures = lines
    .filter((l) => Math.abs(l.y - label.y) <= TOTAL_LINE_TOLERANCE)
    .flatMap((l) => l.cells)
    .filter((c) => c.x >= FIGURES_X)
    .sort((a, b) => a.x - b.x);
  for (const cell of figures) {
    const value = readNumber(cell.text);
    if (value) return value;
  }
  return null;
}
