import { readFileSync } from 'fs';
import { join } from 'path';
import type { ParsedTradingDay } from '../prices/price-source';
import { BocCheck, type CheckContext, runChecks } from './boc-checks';
import { BocDocumentParser, detectBocLayout } from './boc-layout';
import { type Line, readPages } from './boc-pdf-text';

/**
 * Real BOCs downloaded from brvm.org, committed unchanged; their source URLs
 * and layouts are listed in test/fixtures/boc/README.md. Expected figures were
 * read off the printed bulletins.
 */
const FIXTURES = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'test',
  'fixtures',
  'boc',
);
const fixture = (file: string) => readFileSync(join(FIXTURES, file));

const LAYOUTS: Record<string, string> = {
  'boc_20160801.pdf': 'sector-2016',
  'boc_20171002.pdf': 'sector-2016',
  'boc_20171229.pdf': 'sector-2018',
  'boc_20180123.pdf': 'sector-2018',
  'boc_20190115.pdf': 'sector-2018',
  'boc_20200115.pdf': 'sector-2018',
  'boc_20210115.pdf': 'sector-2018',
  'boc_20221230_2.pdf': 'sector-2018',
  'boc_20230102_2.pdf': 'compartment-2023',
  'boc_20240115_2.pdf': 'compartment-2023',
  'boc_20250616_2.pdf': 'compartment-2023',
  'boc_20261110_2.pdf': '2026',
  'boc_20261111_2.pdf': '2026',
  'boc_20261120_2.pdf': '2026',
};

/** Checks run with every listed security as the catalogue, no history. */
const selfContext = (day: ParsedTradingDay): CheckContext => ({
  expectedTradingDate: day.tradingDate,
  catalogueTickers: day.securities.map((s) => s.ticker),
  catalogueIndexCodes: [],
  previousIndexValues: new Map(),
  publishedCloses: new Map(),
});

describe('BOC layouts (real bulletins 2016-2026)', () => {
  const parser = new BocDocumentParser();
  const days = new Map<string, ParsedTradingDay>();
  const pages = new Map<string, Line[][]>();

  // Reading a PDF is slow: each fixture is read once.
  beforeAll(async () => {
    for (const file of [...Object.keys(LAYOUTS), 'boc_20250102_2.pdf']) {
      pages.set(file, await readPages(fixture(file)));
    }
    for (const file of Object.keys(LAYOUTS)) {
      days.set(file, parser.parsePages(pages.get(file) as Line[][]));
    }
  }, 180000);

  const day = (file: string) => days.get(file) as ParsedTradingDay;
  const security = (file: string, ticker: string) =>
    day(file).securities.find((s) => s.ticker === ticker);
  const index = (file: string, code: string) =>
    day(file).indices.find((i) => i.code === code);

  it('detects each layout from what is printed', () => {
    for (const [file, layout] of Object.entries(LAYOUTS)) {
      expect([file, detectBocLayout(pages.get(file) as Line[][])]).toEqual([
        file,
        layout,
      ]);
      expect([file, day(file).layout]).toEqual([file, layout]);
    }
  });

  it('reads the session date and bulletin number', () => {
    expect(day('boc_20160801.pdf')).toMatchObject({
      tradingDate: '2016-08-01',
      reference: '146',
    });
    expect(day('boc_20171002.pdf')).toMatchObject({
      tradingDate: '2017-10-02',
      reference: '187',
    });
    expect(day('boc_20190115.pdf')).toMatchObject({
      tradingDate: '2019-01-15',
      reference: '10',
    });
    expect(day('boc_20230102_2.pdf')).toMatchObject({
      tradingDate: '2023-01-02',
      reference: '1',
    });
    expect(day('boc_20250616_2.pdf')).toMatchObject({
      tradingDate: '2025-06-16',
      reference: '111',
    });
  });

  it('reads a sector-2016 share row: volume and value come first', () => {
    expect(security('boc_20160801.pdf', 'SNTS')).toEqual({
      ticker: 'SNTS',
      name: 'SONATEL SN',
      previousClose: '22805',
      open: '22995',
      close: '22850',
      volume: '19171',
      value: '437175540',
      variation: '0.20',
      traded: true,
    });
    // Not quoted: previous close, NC three times, then the reference price.
    expect(security('boc_20160801.pdf', 'NEIC')).toMatchObject({
      previousClose: '3455',
      open: null,
      close: '3455',
      volume: null,
      traded: false,
    });
    expect(day('boc_20160801.pdf').securities).toHaveLength(40);
    expect(day('boc_20160801.pdf').controls.totalVolume).toBe('71479');
  });

  it('reads a sector-2018 share row: prices come first', () => {
    expect(security('boc_20190115.pdf', 'SNTS')).toEqual({
      ticker: 'SNTS',
      name: 'SONATEL SN',
      previousClose: '16995',
      open: '16980',
      close: '16900',
      volume: '9155',
      value: '155580525',
      variation: '-0.56',
      traded: true,
    });
    expect(security('boc_20190115.pdf', 'SDCC')).toMatchObject({
      close: '3425',
      open: null,
      variation: '0.00',
      traded: false,
    });
    expect(day('boc_20190115.pdf').securities).toHaveLength(45);
    expect(day('boc_20190115.pdf').controls.totalVolume).toBe('111651');
  });

  it('reads a compartment-2023 share row', () => {
    expect(security('boc_20230102_2.pdf', 'PALC')).toEqual({
      ticker: 'PALC',
      name: 'PALM CI',
      previousClose: '10385',
      open: '10000',
      close: '10400',
      volume: '11691',
      value: '115768355',
      variation: '0.14',
      traded: true,
    });
    expect(day('boc_20230102_2.pdf').securities).toHaveLength(46);
  });

  it('reads the BRVM 10 and the sector indices of the sector layouts', () => {
    expect(index('boc_20160801.pdf', 'BRVM-10')).toEqual({
      code: 'BRVM-10',
      name: 'BRVM 10',
      value: '251.93',
      variation: '0.42',
    });
    expect(index('boc_20160801.pdf', 'BRVM-C')).toMatchObject({
      value: '290.11',
      variation: '0.26',
    });
    // Before 2018, sector values are printed only in the share listing.
    expect(index('boc_20160801.pdf', 'BRVM-INDUSTRIE')).toMatchObject({
      value: '182.3',
      variation: '0.55',
    });
    expect(index('boc_20190115.pdf', 'BRVM-10')).toMatchObject({
      value: '150.99',
      variation: '-0.85',
    });
    expect(index('boc_20190115.pdf', 'BRVM-C')).toMatchObject({
      value: '166.15',
      variation: '-0.94',
    });
    expect(index('boc_20190115.pdf', 'BRVM-INDUSTRIE')).toMatchObject({
      value: '56.29',
      variation: '-0.60',
    });
    for (const file of ['boc_20160801.pdf', 'boc_20190115.pdf']) {
      expect(
        day(file)
          .indices.map((i) => i.code)
          .sort(),
      ).toEqual([
        'BRVM-10',
        'BRVM-AGRICULTURE',
        'BRVM-AUTRES-SECTEURS',
        'BRVM-C',
        'BRVM-DISTRIBUTION',
        'BRVM-FINANCES',
        'BRVM-INDUSTRIE',
        'BRVM-SERVICES-PUBLICS',
        'BRVM-TRANSPORT',
      ]);
    }
  });

  it('keeps the old and the new sector indices of 2025 apart', () => {
    const codes = day('boc_20250616_2.pdf').indices.map((i) => i.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'BRVM-C',
        'BRVM-30',
        'BRVM-PRESTIGE',
        'BRVM-PRINCIPAL',
        'BRVM-SERVICES-PUBLICS',
        'BRVM-SPU',
        'BRVM-TEL',
      ]),
    );
    expect(codes).not.toContain('BRVM-10');
    expect(index('boc_20250616_2.pdf', 'BRVM-SERVICES-PUBLICS')?.value).toBe(
      '739.27',
    );
    expect(index('boc_20250616_2.pdf', 'BRVM-TEL')?.value).toBe('96.33');
    expect(index('boc_20230102_2.pdf', 'BRVM-30')).toMatchObject({
      value: '100.13',
    });
    expect(index('boc_20230102_2.pdf', 'BRVM-C')).toMatchObject({
      value: '206.34',
      variation: '1.54',
    });
  });

  it('reads bulletins that pass every check, figures and repeats agreeing', () => {
    for (const file of Object.keys(LAYOUTS)) {
      if (file === 'boc_20221230_2.pdf') continue;
      const parsed = day(file);
      const failures = runChecks(parsed, selfContext(parsed));
      if (file === 'boc_20200115.pdf') {
        // As printed: ETIT, at 13 FCFA, moved one tick (7.69%), more than
        // the limit allows. A real reason to hold the day for an admin.
        expect(failures).toEqual([
          expect.objectContaining({
            check: BocCheck.VARIATION_LIMITS,
            subject: 'ETIT',
          }),
        ]);
        continue;
      }
      expect([file, failures]).toEqual([file, []]);
      expect(parsed.controls.totalVolume).not.toBeNull();
      expect(parsed.controls.repeatedIndexValues.length).toBeGreaterThan(0);
    }
  });

  it('reports a row printed without its open as unreadable, so the day is held', () => {
    // ORAC's row on 2022-12-30 prints two prices and no variation.
    const parsed = day('boc_20221230_2.pdf');
    expect(parsed.unreadableRows).toEqual([
      expect.stringMatching(/^ORAC ORANGE COTE D''IVOIRE/),
    ]);
    expect(runChecks(parsed, selfContext(parsed)).map((f) => f.check)).toEqual([
      BocCheck.READABLE,
      BocCheck.VOLUMES,
    ]);
  });

  it('refuses a bulletin in no known layout with a readable reason', async () => {
    // brvm.org serves an English edition for 2025-01-02.
    const english = pages.get('boc_20250102_2.pdf') as Line[][];
    expect(detectBocLayout(english)).toBeNull();
    expect(() => parser.parsePages(english)).toThrow(
      /^Not a BOC in any known layout .*; its front page starts "N° 1 BRVM COMPOSITE 276\.13/,
    );
  });

  it('refuses a PDF that is not a BOC', async () => {
    await expect(parser.parse(Buffer.from('not a pdf'))).rejects.toThrow();
  });
});
