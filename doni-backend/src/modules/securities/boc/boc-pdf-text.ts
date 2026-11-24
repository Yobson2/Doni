import { getDocument } from 'pdfjs-dist/legacy/build/pdf';

/**
 * Reading a BOC PDF as positioned text, shared by every layout's parser: the
 * text cells of each page grouped into printed lines, and the way the BOC
 * prints numbers and dates.
 */

export interface TextCell {
  x: number;
  y: number;
  text: string;
}

/** Cells that share a baseline: one printed line. */
export interface Line {
  y: number;
  cells: TextCell[];
}

/** The PDF is not a BOC in the layout being read, or in any known layout. */
export class BocLayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BocLayoutError';
  }
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f\u200b]/g;

/** Cells whose baselines are this close (PDF units) are one line. */
const SAME_LINE = 1.5;

/** Each page of the PDF as printed lines, top of the page first. */
export async function readPages(document: Uint8Array): Promise<Line[][]> {
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

export const lineText = (line: Line): string =>
  line.cells.map((c) => c.text).join(' ');

// ─── Numbers ─────────────────────────────────────────────────

/**
 * A printed number as a decimal string: "13 000" -> "13000",
 * "-0,21 %" -> "-0.21". Null when the text is not a number.
 */
export function readNumber(text: string): string | null {
  const compact = text.replace(/[\s\u00a0\u202f%]/g, '').replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(compact) ? compact : null;
}

export const isPercent = (text: string): boolean => /%\s*$/.test(text);

// ─── Session date ────────────────────────────────────────────

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

/**
 * The session date ("mardi 15 janvier 2019", "1er") and the bulletin number
 * ("N° 10") printed on the front page.
 */
export function readHeader(
  front: Line[],
  error: (detail: string) => Error,
): { tradingDate: string; reference: string | null } {
  const text = front.map(lineText).join('\n');
  const date = new RegExp(
    `(\\d{1,2})(?:er)?\\s+(${MONTHS.join('|')})\\s+(\\d{4})`,
    'i',
  ).exec(text);
  if (!date) throw error('no session date on the front page');
  const month = MONTHS.indexOf(date[2].toLowerCase()) + 1;
  const tradingDate = `${date[3]}-${pad(month)}-${pad(Number(date[1]))}`;
  const number = /N°\s*(\d+)/.exec(text);
  return { tradingDate, reference: number ? number[1] : null };
}

const pad = (n: number) => String(n).padStart(2, '0');
