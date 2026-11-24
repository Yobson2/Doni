import { Injectable } from '@nestjs/common';
import type {
  ParsedTradingDay,
  PriceDocumentParser,
} from '../prices/price-source';
import { type LegacyBocLayout, readLegacyLayout } from './boc-legacy-parser';
import { read2026Layout } from './boc-parser';
import { BocLayoutError, type Line, lineText, readPages } from './boc-pdf-text';

/** Every BOC layout Doni can read. */
export type BocLayout = '2026' | LegacyBocLayout;

/**
 * Which layout a BOC is printed in, from what its pages say, or null when it
 * is none Doni knows. Never guessed from the date: the BRVM has changed the
 * layout mid-year, and published an English edition at least once.
 *
 * - 2026: "INDICES PAR COMPARTIMENT" on the front page, the share listing
 *   closed by "TOTAL - MARCHE DES ACTIONS" (capitals);
 * - compartment-2023: the same front-page table, the listing closed by
 *   "TOTAL - Marché des actions";
 * - sector-2018: "INDICES SECTORIELS" and the BRVM 10 on the front page, share
 *   rows starting with the previous close;
 * - sector-2016: the BRVM 10 on the front page, share rows starting with the
 *   volume (the "Volume" column left of "Ouv.").
 */
export function detectBocLayout(pages: Line[][]): BocLayout | null {
  if (pages.length < 2) return null;
  const front = pages[0].map(lineText);
  const listing = pages.slice(1).flat();
  const listingText = listing.map(lineText);

  const frenchDate =
    /\d{1,2}(er)?\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}/i;
  if (!front.some((t) => frenchDate.test(t))) return null;

  const compartmentTable = front.some((t) =>
    t.startsWith('INDICES PAR COMPARTIMENT'),
  );
  if (compartmentTable) {
    if (listingText.some((t) => t.startsWith('TOTAL - MARCHE DES ACTIONS'))) {
      return '2026';
    }
    if (listingText.some((t) => /^TOTAL\s*-\s*Marché des actions/.test(t))) {
      return 'compartment-2023';
    }
    return null;
  }

  const brvm10 = pages[0].some((l) =>
    l.cells.some((c) => c.text === 'BRVM 10'),
  );
  const header = listing.find(
    (l) =>
      l.cells.some((c) => c.text === 'Ouv.') &&
      l.cells.some((c) => c.text === 'Clôt.'),
  );
  if (!brvm10 || !header) return null;
  const x = (text: string) => header.cells.find((c) => c.text === text)?.x;
  const open = x('Ouv.');
  const volume = x('Volume');
  if (open === undefined || volume === undefined) return null;
  if (volume < open) return 'sector-2016';
  return front.some((t) => t.startsWith('INDICES SECTORIELS'))
    ? 'sector-2018'
    : null;
}

/**
 * The PriceDocumentParser for BOCs: detects the layout and reads the
 * bulletin with that layout's reader. A bulletin in no known layout is
 * refused with a readable reason, so its day is held rather than misread.
 */
@Injectable()
export class BocDocumentParser implements PriceDocumentParser {
  async parse(document: Uint8Array): Promise<ParsedTradingDay> {
    return this.parsePages(await readPages(document));
  }

  /** The same, from a document's pages already read. */
  parsePages(pages: Line[][]): ParsedTradingDay {
    const layout = detectBocLayout(pages);
    if (!layout) {
      throw new BocLayoutError(
        `Not a BOC in any known layout (2026, compartment-2023, sector-2018, sector-2016); its front page starts "${frontPageStart(pages)}"`,
      );
    }
    return layout === '2026'
      ? read2026Layout(pages)
      : readLegacyLayout(pages, layout);
  }
}

const frontPageStart = (pages: Line[][]) =>
  (pages[0] ?? []).map(lineText).join(' ').slice(0, 80);
