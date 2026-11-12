/**
 * Real BRVM data, hand-copied from three official BOCs (Bulletin Officiel de
 * la Cote) published on brvm.org:
 *
 *   N° 213, lundi 9 novembre 2026     boc_20261109_2.pdf
 *   N° 214, mardi 10 novembre 2026    boc_20261110_2.pdf
 *   N° 215, mercredi 11 novembre 2026 boc_20261111_2.pdf
 *
 * Per security: "Cours du jour" opening (Ouv.) and closing (Clôt.) prices and
 * the session volume, exactly as printed (XOF; French decimal commas become
 * points). Index values come from the bulletin's front page. Each BOC is the
 * bulletin of the session it is dated; `publishedOn` is that date.
 *
 * ISINs are not printed in the BOC and are left empty rather than guessed.
 * Profiles are short factual descriptions written in French; the English
 * text is a translation and is marked as such (profileOriginalLanguage).
 */

const BOC_BASE_URL = 'https://www.brvm.org/sites/default/files';
const bocUrl = (date: string) =>
  `${BOC_BASE_URL}/boc_${date.replace(/-/g, '')}_2.pdf`;

export interface SeedSector {
  code: string;
  nameFr: string;
  nameEn: string;
}

export interface SeedPrice {
  date: string;
  open: string | null;
  close: string;
  volume: string | null;
}

export interface SeedSecurity {
  ticker: string;
  name: string;
  sectorCode: string;
  country: string;
  profileFr: string;
  profileEn: string;
  prices: SeedPrice[];
}

export interface SeedIndex {
  code: string;
  name: string;
  values: { date: string; close: string }[];
}

/** The BOC a seeded price was read from. */
export const seedSourceDocument = (date: string): string => bocUrl(date);

/** Sector codes as the BOC prints them ("Code Sect. Act."). */
export const SEED_SECTORS: SeedSector[] = [
  { code: 'CB', nameFr: 'Consommation de base', nameEn: 'Consumer staples' },
  {
    code: 'FIN',
    nameFr: 'Services financiers',
    nameEn: 'Financial services',
  },
  {
    code: 'TEL',
    nameFr: 'Télécommunications',
    nameEn: 'Telecommunications',
  },
];

export const SEED_SECURITIES: SeedSecurity[] = [
  {
    ticker: 'ETIT',
    name: 'Ecobank Transnational Incorporated (ETI)',
    sectorCode: 'FIN',
    country: 'TG',
    profileFr:
      'Groupe bancaire dont le siège est à Lomé (Togo), coté à la BRVM dans le secteur des services financiers.',
    profileEn:
      'Banking group headquartered in Lomé (Togo), listed on the BRVM in the financial services sector.',
    prices: [
      { date: '2026-11-09', open: '60', close: '59', volume: '670877' },
      { date: '2026-11-10', open: '59', close: '60', volume: '765580' },
      { date: '2026-11-11', open: '59', close: '60', volume: '658363' },
    ],
  },
  {
    ticker: 'ORAC',
    name: "Orange Côte d'Ivoire",
    sectorCode: 'TEL',
    country: 'CI',
    profileFr:
      "Opérateur de télécommunications en Côte d'Ivoire, coté à la BRVM dans le secteur des télécommunications.",
    profileEn:
      "Telecommunications operator in Côte d'Ivoire, listed on the BRVM in the telecommunications sector.",
    prices: [
      { date: '2026-11-09', open: '21000', close: '21000', volume: '379' },
      { date: '2026-11-10', open: '21000', close: '20000', volume: '2197' },
      { date: '2026-11-11', open: '20000', close: '20000', volume: '1309' },
    ],
  },
  {
    ticker: 'PALC',
    name: "PALM Côte d'Ivoire (PALMCI)",
    sectorCode: 'CB',
    country: 'CI',
    profileFr:
      "Société dont le siège est à Abidjan (Côte d'Ivoire), cotée à la BRVM dans le secteur de la consommation de base.",
    profileEn:
      "Company headquartered in Abidjan (Côte d'Ivoire), listed on the BRVM in the consumer staples sector.",
    prices: [
      { date: '2026-11-09', open: '7900', close: '7600', volume: '13342' },
      { date: '2026-11-10', open: '7600', close: '7595', volume: '5782' },
      { date: '2026-11-11', open: '7600', close: '7590', volume: '635' },
    ],
  },
  {
    ticker: 'SGBC',
    name: "Société Générale Côte d'Ivoire",
    sectorCode: 'FIN',
    country: 'CI',
    profileFr:
      "Banque en Côte d'Ivoire, cotée à la BRVM dans le secteur des services financiers.",
    profileEn:
      "Bank in Côte d'Ivoire, listed on the BRVM in the financial services sector.",
    prices: [
      { date: '2026-11-09', open: '39205', close: '39000', volume: '6089' },
      { date: '2026-11-10', open: '39000', close: '38900', volume: '2721' },
      { date: '2026-11-11', open: '38895', close: '38600', volume: '1126' },
    ],
  },
  {
    ticker: 'SNTS',
    name: 'Société Nationale de Télécommunication du Sénégal (SONATEL)',
    sectorCode: 'TEL',
    country: 'SN',
    profileFr:
      'Opérateur de télécommunications dont le siège est à Dakar (Sénégal), coté à la BRVM dans le secteur des télécommunications.',
    profileEn:
      'Telecommunications operator headquartered in Dakar (Senegal), listed on the BRVM in the telecommunications sector.',
    prices: [
      { date: '2026-11-09', open: '4010', close: '4150', volume: '105946' },
      { date: '2026-11-10', open: '4150', close: '4000', volume: '270403' },
      { date: '2026-11-11', open: '4000', close: '4190', volume: '85624' },
    ],
  },
];

export const SEED_INDICES: SeedIndex[] = [
  {
    code: 'BRVM-C',
    name: 'BRVM Composite',
    values: [
      { date: '2026-11-09', close: '521.88' },
      { date: '2026-11-10', close: '512.81' },
      { date: '2026-11-11', close: '517.17' },
    ],
  },
  {
    code: 'BRVM-30',
    name: 'BRVM 30',
    values: [
      { date: '2026-11-09', close: '252.36' },
      { date: '2026-11-10', close: '247.47' },
      { date: '2026-11-11', close: '250.13' },
    ],
  },
];
