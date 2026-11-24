# BOC fixtures

Real Bulletins Officiels de la Cote, downloaded unchanged from the BRVM's
public website (`https://www.brvm.org/sites/default/files/<file>`). Nothing
here is hand-made: a test that needs a different bulletin uses another real
one, or alters a real one in a way the test states (e.g. bytes appended to
change its checksum).

| File | Session | Layout | Source URL |
| --- | --- | --- | --- |
| `boc_20160801.pdf` | 2016-08-01, N° 146 | sector-2016 | https://www.brvm.org/sites/default/files/boc_20160801.pdf |
| `boc_20171002.pdf` | 2017-10-02, N° 187 | sector-2016 | https://www.brvm.org/sites/default/files/boc_20171002.pdf |
| `boc_20171229.pdf` | 2017-12-29 | sector-2018 | https://www.brvm.org/sites/default/files/boc_20171229.pdf |
| `boc_20180123.pdf` | 2018-01-23, N° 16 | sector-2018 | https://www.brvm.org/sites/default/files/boc_20180123.pdf |
| `boc_20190115.pdf` | 2019-01-15, N° 10 | sector-2018 | https://www.brvm.org/sites/default/files/boc_20190115.pdf |
| `boc_20200115.pdf` | 2020-01-15 | sector-2018 | https://www.brvm.org/sites/default/files/boc_20200115.pdf |
| `boc_20210115.pdf` | 2021-01-15, N° 10 | sector-2018 | https://www.brvm.org/sites/default/files/boc_20210115.pdf |
| `boc_20221230_2.pdf` | 2022-12-30 (last sector-2018 seen) | sector-2018 | https://www.brvm.org/sites/default/files/boc_20221230_2.pdf |
| `boc_20230102_2.pdf` | 2023-01-02 (first compartment bulletin) | compartment-2023 | https://www.brvm.org/sites/default/files/boc_20230102_2.pdf |
| `boc_20240115_2.pdf` | 2024-01-15 | compartment-2023 | https://www.brvm.org/sites/default/files/boc_20240115_2.pdf |
| `boc_20250102_2.pdf` | 2025-01-02, N° 1, English edition | not recognised | https://www.brvm.org/sites/default/files/boc_20250102_2.pdf |
| `boc_20250616_2.pdf` | 2025-06-16 (old and new sector indices) | compartment-2023 | https://www.brvm.org/sites/default/files/boc_20250616_2.pdf |
| `boc_20261110_2.pdf` | 2026-11-10, N° 214 | 2026 | https://www.brvm.org/sites/default/files/boc_20261110_2.pdf |
| `boc_20261111_2.pdf` | 2026-11-11, N° 215 | 2026 | https://www.brvm.org/sites/default/files/boc_20261111_2.pdf |
| `boc_20261120_2.pdf` | 2026-11-20 | 2026 | https://www.brvm.org/sites/default/files/boc_20261120_2.pdf |

## Layouts

The layouts are named after the year they were first seen in this set; the
parser recognises them by what is printed, never by date
(`src/modules/securities/boc/boc-layout.ts`).

- **sector-2016** (seen from 2016-08 to 2017-10): a small front page with
  BRVM 10 and BRVM Composite and their daily variation; shares grouped by
  sector ("SECTEUR - INDUSTRIE 151 points"), each row reading volume, value,
  previous close, open, close, average, variation, ...; sector index values are
  printed only in the share listing.
- **sector-2018** (seen from 2017-12 to 2022-12): "BULLETIN OFFICIEL DE LA
  COTE" front page with BRVM 10 and BRVM Composite, an "INDICES SECTORIELS"
  table; shares grouped by sector, each row reading previous close, open,
  close, variation, volume, value, reference price, ...
- **compartment-2023** (seen from 2023-01 to 2025-12): BRVM COMPOSITE, BRVM 30
  and BRVM PRESTIGE on the front page, "INDICES PAR COMPARTIMENT" and the old
  sector indices ("INDICES SECTORIELS", in 2025 "INDICES SECTORIELS ANCIENS"
  and "NOUVEAUX"); shares grouped by compartment; totals labelled
  "TOTAL - Marché des actions".
- **2026**: the current layout, read by `boc-parser.ts`.

The bulletin of 2025-01-02 on brvm.org is an English edition (decimal points,
comma thousands, no session date printed): no parser recognises it, so its day
is held with that reason rather than read with the wrong number format.

Bulletins before mid-2016 are not on brvm.org under these names (probed
2015-01 to 2016-06: every request returned 404).
