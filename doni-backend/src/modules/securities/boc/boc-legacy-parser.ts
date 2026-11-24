import type {
  ParsedIndexValue,
  ParsedSecurityPrice,
  ParsedTradingDay,
} from '../prices/price-source';
import { BOC_INDEX_CODES } from './boc-parser';
import {
  BocLayoutError,
  isPercent,
  type Line,
  type TextCell,
  lineText,
  readHeader,
  readNumber,
} from './boc-pdf-text';

/**
 * The BOC layouts used before 2026, as found in real bulletins on brvm.org
 * (test/fixtures/boc/README.md describes each). They are named after the
 * year they were first seen; boc-layout.ts tells them apart by what is
 * printed, never by date.
 */
export type LegacyBocLayout =
  | 'sector-2016'
  | 'sector-2018'
  | 'compartment-2023';

type RepeatedValue = { code: string; value: string; where: string };

/**
 * Doni's code for each index printed in a pre-2026 BOC, by its printed name
 * with the "BRVM" prefix, dashes and extra spaces removed.
 *
 * - BRVM 10 was replaced by BRVM 30 in 2023 with another composition: it keeps
 *   its own code rather than being joined onto BRVM-30.
 * - The sector indices printed until 2025 ("INDICES SECTORIELS", then
 *   "ANCIENS") are other series than the sector indices of 2026 (which start
 *   at 100 in 2025 and are printed as "NOUVEAUX" that year), even where the
 *   name is the same (SERVICES PUBLICS): they get codes of their own.
 */
export const LEGACY_INDEX_CODES: Record<string, string> = {
  '10': 'BRVM-10',
  COMPOSITE: 'BRVM-C',
  '30': 'BRVM-30',
  PRESTIGE: 'BRVM-PRESTIGE',
  PRINCIPAL: 'BRVM-PRINCIPAL',
  INDUSTRIE: 'BRVM-INDUSTRIE',
  'SERVICES PUBLICS': 'BRVM-SERVICES-PUBLICS',
  FINANCES: 'BRVM-FINANCES',
  TRANSPORT: 'BRVM-TRANSPORT',
  AGRICULTURE: 'BRVM-AGRICULTURE',
  DISTRIBUTION: 'BRVM-DISTRIBUTION',
  'AUTRES SECTEURS': 'BRVM-AUTRES-SECTEURS',
};

/** A day read from the pages of a BOC in one of the pre-2026 layouts. */
export function readLegacyLayout(
  pages: Line[][],
  layout: LegacyBocLayout,
): ParsedTradingDay {
  const error = (detail: string) =>
    new BocLayoutError(`Not a BOC in the ${layout} layout: ${detail}`);
  if (pages.length < 2) throw error('no share listing');
  const front = pages[0];
  const { tradingDate, reference } = readHeader(front, error);

  const indices = readHeadline(front, error);
  const repeated: RepeatedValue[] = [];
  const add = (index: ParsedIndexValue, where: string) => {
    if (indices.some((i) => i.code === index.code)) {
      repeated.push({ code: index.code, value: index.value, where });
    } else {
      indices.push(index);
    }
  };
  for (const index of readIndexTables(front)) add(index, 'index tables');
  repeated.push(...readDailyIndexTable(front));

  const shares = readShareListing(pages.slice(1), error);
  // Before 2018, sector index values are printed only in the share listing.
  for (const heading of shares.headings) {
    add(heading, 'share listing heading');
  }

  return {
    tradingDate,
    reference,
    layout,
    securities: shares.securities,
    indices,
    controls: {
      totalVolume: shares.totalVolume,
      repeatedIndexValues: repeated,
    },
    unreadableRows: shares.unreadableRows,
  };
}

// ─── Index names ─────────────────────────────────────────────

/** A footnote call printed after a name, e.g. "BRVM-PRINCIPAL (**)". */
const FOOTNOTE_MARK = /\(\*+\)/g;

const indexKey = (printedName: string) =>
  printedName
    .replace(FOOTNOTE_MARK, '')
    .toUpperCase()
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(BRVM|SECTEUR|COMPARTIMENT)\s*/, '')
    .replace(/\s*POINTS$/, '');

const printedName = (cells: TextCell[]) =>
  cells
    .map((c) => c.text)
    .join(' ')
    .replace(FOOTNOTE_MARK, '')
    .replace(/\s+/g, ' ')
    .trim();

// ─── Front page ──────────────────────────────────────────────

/** The indices printed large at the top of the front page. */
const HEADLINE_NAMES = new Set([
  'BRVM 10',
  'BRVM Composite',
  'BRVM COMPOSITE',
  'BRVM 30',
  'BRVM PRESTIGE',
]);
/** Cells this close (PDF units) to a label's baseline belong with it. */
const BAND = 4;
/** The daily variation is printed at most this far below its index. */
const VARIATION_BELOW = 40;
const DAILY_VARIATION_LABEL = /^Variation(\s+Jour|\s*:)$/;

/**
 * Each headline index with the value printed beside it and the daily
 * variation printed under it. Values and labels are not always on the same
 * baseline, so the cells near a label's baseline and between it and the next
 * label to its right belong to it.
 */
function readHeadline(
  front: Line[],
  error: (detail: string) => Error,
): ParsedIndexValue[] {
  const cells = front.flatMap((l) => l.cells);
  const labels = new Map<string, TextCell>();
  for (const cell of cells) {
    if (!HEADLINE_NAMES.has(cell.text)) continue;
    const seen = labels.get(cell.text);
    // A name printed again lower down (a chart, a table) is not the headline.
    if (!seen || cell.y > seen.y) labels.set(cell.text, cell);
  }
  if (labels.size === 0) throw error('no headline indices on the front page');
  const all = [...labels.values()];
  const rightEdge = (label: TextCell) =>
    Math.min(
      ...all
        .filter((o) => Math.abs(o.y - label.y) <= BAND && o.x > label.x)
        .map((o) => o.x),
    );
  const near = (y: number, from: number, to: number) =>
    cells
      .filter((c) => Math.abs(c.y - y) <= BAND && c.x > from && c.x < to)
      .sort((a, b) => a.x - b.x);

  const indices: ParsedIndexValue[] = [];
  for (const label of all.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const to = rightEdge(label);
    const value = near(label.y, label.x, to)
      .filter((c) => !isPercent(c.text))
      .map((c) => readNumber(c.text))
      .find((v) => v !== null);
    const code = LEGACY_INDEX_CODES[indexKey(label.text)];
    if (!value || !code) throw error(`no value printed for ${label.text}`);

    const variationLabel = cells
      .filter(
        (c) =>
          DAILY_VARIATION_LABEL.test(c.text) &&
          c.y < label.y &&
          label.y - c.y <= VARIATION_BELOW,
      )
      .sort((a, b) => b.y - a.y)[0];
    const variation = variationLabel
      ? near(variationLabel.y, label.x - 1, to)
          .filter((c) => isPercent(c.text))
          .map((c) => readNumber(c.text))
          .find((v) => v !== null)
      : undefined;
    indices.push({
      code,
      name: label.text,
      value,
      variation: variation ?? null,
    });
  }
  return indices;
}

/** In the index tables, names sit left of this x and figures right of it. */
const INDEX_TABLE_FIGURES_X = 140;

/**
 * The compartment and sector index tables of the front page (from 2018).
 * A sector table headed "NOUVEAUX" (2025) holds the sector indices of 2026.
 */
function readIndexTables(front: Line[]): ParsedIndexValue[] {
  const indices: ParsedIndexValue[] = [];
  let table: 'compartment' | 'old-sector' | 'new-sector' | null = null;
  for (const line of front) {
    const text = lineText(line);
    if (text.startsWith('INDICES PAR COMPARTIMENT')) table = 'compartment';
    else if (text.startsWith('INDICES SECTORIELS')) {
      table = /NOUVEAUX/.test(text) ? 'new-sector' : 'old-sector';
    }
    if (!table || !line.cells[0].text.startsWith('BRVM')) continue;
    const nameCells = line.cells.filter((c) => c.x < INDEX_TABLE_FIGURES_X);
    const figures = line.cells
      .filter((c) => c.x >= INDEX_TABLE_FIGURES_X)
      .map((c) => c.text);
    const key = indexKey(nameCells.map((c) => c.text).join(' '));
    const code =
      table === 'new-sector' ? BOC_INDEX_CODES[key] : LEGACY_INDEX_CODES[key];
    // Figures: number of companies, value, daily variation, ...
    const value = figures[1] ? readNumber(figures[1]) : null;
    if (!code || !value) continue;
    const variation =
      figures[2] && isPercent(figures[2]) ? readNumber(figures[2]) : null;
    indices.push({ code, name: printedName(nameCells), value, variation });
  }
  return indices;
}

/**
 * The "Indices du jour" box of the sector-2016 front page: each headline
 * index's opening and closing value. The close repeats the headline value.
 */
function readDailyIndexTable(front: Line[]): RepeatedValue[] {
  const repeated: RepeatedValue[] = [];
  const at = front.findIndex((l) =>
    l.cells.some((c) => c.text === 'Indices du jour'),
  );
  if (at < 0) return repeated;
  for (const line of front.slice(at + 1)) {
    const label = line.cells.find((c) => HEADLINE_NAMES.has(c.text));
    if (!label) continue;
    const figures = line.cells
      .filter((c) => c.x > label.x && !isPercent(c.text))
      .map((c) => readNumber(c.text));
    const code = LEGACY_INDEX_CODES[indexKey(label.text)];
    // Figures: opening, closing.
    if (code && figures[1]) {
      repeated.push({
        code,
        value: figures[1],
        where: '"Indices du jour" box',
      });
    }
  }
  return repeated;
}

// ─── Share listing ───────────────────────────────────────────

/** BRVM symbols: upper-case letters, e.g. SNTS, CBIBF. */
const SYMBOL = /^[A-Z]{3,6}$/;
/** Printed instead of an open and close when a share did not trade. */
const NOT_TRADED = new Set(['SP', 'NC']);
/** How far (PDF units) a row's symbol may sit from its column heading. */
const SYMBOL_TOLERANCE = 10;
/** Figures start this far left of their column heading (right-aligned). */
const FIGURES_MARGIN = 12;
/** A column heading may sit this far above the line that names Ouv./Clôt. */
const HEADER_DEPTH = 25;
/** A total's figures may sit a few units off its label's baseline. */
const TOTAL_LINE_TOLERANCE = 6;
const SHARES_END = /^TOTAL\s*-\s*March[ée] des actions/i;
const BLOCK_HEADING = /^(SECTEUR\b|AUTRES SECTEURS|COMPARTIMENT\b|BRVM\b)/;

/** Where a page's share-listing columns are, from its column headings. */
interface Columns {
  symbolX: number;
  figuresX: number;
  /** sector-2016 rows start with volume and value, later ones with prices. */
  volumeFirst: boolean;
}

function columnsOf(lines: Line[], at: number): Columns | null {
  const header = lines[at];
  const find = (text: string) => {
    for (const line of lines.slice(0, at + 1).reverse()) {
      if (header.y - line.y > 0 || line.y - header.y > HEADER_DEPTH) continue;
      const cell = line.cells.find((c) => c.text === text);
      if (cell) return cell;
    }
    return undefined;
  };
  const open = find('Ouv.');
  const volume = find('Volume');
  const symbol = find('Symbole');
  const previous = find('Précédent');
  if (!open || !volume || !symbol || !previous) return null;
  const volumeFirst = volume.x < open.x;
  return {
    symbolX: symbol.x,
    figuresX: (volumeFirst ? volume.x : previous.x) - FIGURES_MARGIN,
    volumeFirst,
  };
}

const isColumnHeader = (line: Line) =>
  line.cells.some((c) => c.text === 'Ouv.') &&
  line.cells.some((c) => c.text === 'Clôt.');

function readShareListing(
  pages: Line[][],
  error: (detail: string) => Error,
): {
  securities: ParsedSecurityPrice[];
  headings: ParsedIndexValue[];
  totalVolume: string | null;
  unreadableRows: string[];
} {
  const securities: ParsedSecurityPrice[] = [];
  const headings: ParsedIndexValue[] = [];
  const unreadableRows: string[] = [];

  // A continuation page may print no column headings: it keeps the last ones.
  let columns: Columns | null = null;
  for (const lines of pages) {
    for (const [n, line] of lines.entries()) {
      if (isColumnHeader(line)) {
        columns = columnsOf(lines, n) ?? columns;
        continue;
      }
      if (!columns) continue;
      if (SHARES_END.test(lineText(line))) {
        if (securities.length === 0) break;
        return {
          securities,
          headings,
          totalVolume: totalNear(lines, line),
          unreadableRows,
        };
      }
      const first = line.cells[0];
      // Block headings start at the left margin, at or before the symbols.
      if (
        BLOCK_HEADING.test(first.text) &&
        first.x <= columns.symbolX + SYMBOL_TOLERANCE
      ) {
        const heading = readHeading(line);
        if (heading) headings.push(heading);
        continue;
      }
      if (Math.abs(first.x - columns.symbolX) > SYMBOL_TOLERANCE) continue;
      if (!SYMBOL.test(first.text) || first.text === 'TOTAL') continue;
      const row = readShareRow(line, columns);
      if (row) securities.push(row);
      else unreadableRows.push(lineText(line));
    }
  }
  throw error('no share listing found');
}

/**
 * A block heading of the share listing: "SECTEUR - INDUSTRIE 56,29 points
 * -0,60 %", "COMPARTIMENT PRESTIGE ...", "BRVM PRESTIGE ...".
 */
function readHeading(line: Line): ParsedIndexValue | null {
  // The value may share its cell with the unit: "156,91 points".
  const figure = (c: TextCell) => readNumber(c.text.replace(/\s*points$/, ''));
  const firstFigure = line.cells.findIndex((c) => figure(c) !== null);
  if (firstFigure < 1) return null;
  const nameCells = line.cells.slice(0, firstFigure);
  const code = LEGACY_INDEX_CODES[indexKey(printedName(nameCells))];
  const value = figure(line.cells[firstFigure]);
  if (!code || !value) return null;
  const variationCell = line.cells.find((c) => isPercent(c.text));
  return {
    code,
    name: printedName(nameCells),
    value,
    variation: variationCell ? readNumber(variationCell.text) : null,
  };
}

function readShareRow(
  line: Line,
  columns: Columns,
): ParsedSecurityPrice | null {
  const ticker = line.cells[0].text;
  const name = line.cells
    .slice(1)
    .filter((c) => c.x < columns.figuresX)
    .map((c) => c.text)
    .join(' ');
  const f = line.cells
    .filter((c) => c.x >= columns.figuresX)
    .map((c) => c.text);
  const n = (i: number) => (f[i] ? readNumber(f[i]) : null);

  if (NOT_TRADED.has(f[1]) && NOT_TRADED.has(f[2])) {
    const previousClose = n(0);
    // sector-2016: previous, SP/NC (x3), [variation of the year], reference.
    // Later: previous, SP/NC (x2), variation, reference, ...
    const rest = f.slice(1).filter((t) => !NOT_TRADED.has(t));
    const variation =
      !columns.volumeFirst && rest[0] && isPercent(rest[0])
        ? readNumber(rest[0])
        : null;
    const reference = rest
      .filter((t) => !isPercent(t))
      .map((t) => readNumber(t))[0];
    if (!previousClose || !reference) return null;
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

  // sector-2016: volume, value, previous, open, close, average, variation.
  // Later: previous, open, close, variation, volume, value, reference.
  const [volume, value, previousClose, open, close, variationAt] =
    columns.volumeFirst ? [0, 1, 2, 3, 4, 6] : [4, 5, 0, 1, 2, 3];
  const figures = {
    volume: n(volume),
    value: n(value),
    previousClose: n(previousClose),
    open: n(open),
    close: n(close),
  };
  if (Object.values(figures).some((v) => v === null)) return null;
  if (!f[variationAt] || !isPercent(f[variationAt])) return null;
  return {
    ticker,
    name,
    previousClose: figures.previousClose,
    open: figures.open,
    close: figures.close as string,
    volume: figures.volume,
    value: figures.value,
    variation: readNumber(f[variationAt]),
    traded: true,
  };
}

/** The first figure printed right of a total's label, on or near its line. */
function totalNear(lines: Line[], label: Line): string | null {
  const labelEnd = Math.max(
    ...label.cells.filter((c) => readNumber(c.text) === null).map((c) => c.x),
  );
  const figures = lines
    .filter((l) => Math.abs(l.y - label.y) <= TOTAL_LINE_TOLERANCE)
    .flatMap((l) => l.cells)
    .filter((c) => c.x > labelEnd)
    .sort((a, b) => a.x - b.x);
  for (const cell of figures) {
    const value = readNumber(cell.text);
    if (value) return value;
  }
  return null;
}
