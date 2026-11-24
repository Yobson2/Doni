import { bocLinksFor } from './boc-fetcher';

// Links as the BRVM listing page prints them: the file name suffix varies.
const LISTING = `
<a href="https://www.brvm.org/sites/default/files/boc_20261120_2.pdf">BOC</a>
<a href="https://www.brvm.org/sites/default/files/boc_20261118.pdf">BOC</a>
<a href="/sites/default/files/boc_20261111_2_0.pdf">BOC</a>
<a href="https://www.brvm.org/sites/default/files/boc_20261111_2.pdf">BOC</a>
`;
const BASE = 'https://www.brvm.org/fr/bulletins-officiels-de-la-cote';

describe('bocLinksFor', () => {
  it('finds the day’s bulletin whatever its suffix', () => {
    expect(bocLinksFor(LISTING, '20261120', BASE)).toEqual([
      'https://www.brvm.org/sites/default/files/boc_20261120_2.pdf',
    ]);
    expect(bocLinksFor(LISTING, '20261118', BASE)).toEqual([
      'https://www.brvm.org/sites/default/files/boc_20261118.pdf',
    ]);
  });

  it('resolves relative links and keeps every candidate for a day', () => {
    expect(bocLinksFor(LISTING, '20261111', BASE)).toEqual([
      'https://www.brvm.org/sites/default/files/boc_20261111_2_0.pdf',
      'https://www.brvm.org/sites/default/files/boc_20261111_2.pdf',
    ]);
  });

  it('finds nothing for a day that is not listed', () => {
    expect(bocLinksFor(LISTING, '20261123', BASE)).toEqual([]);
  });
});
