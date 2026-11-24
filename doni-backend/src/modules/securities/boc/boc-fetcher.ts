import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** A BOC as downloaded: the PDF's bytes and where they came from. */
export interface FetchedBoc {
  document: Buffer;
  sourceUrl: string;
}

/**
 * Gets the BOC of one trading day. Behind an interface so that tests (and a
 * future licensed feed) never depend on the BRVM website.
 */
export interface BocFetcher {
  /** The day's BOC, or null when it is not published (yet). */
  fetch(tradingDate: string): Promise<FetchedBoc | null>;
}

export const BOC_FETCHER = Symbol('BocFetcher');

/** The BRVM page that lists recent bulletins, newest first. */
export const DEFAULT_BOC_LISTING_URL =
  'https://www.brvm.org/fr/bulletins-officiels-de-la-cote';
/** Where the BRVM site keeps the bulletin PDFs. */
export const DEFAULT_BOC_FILES_URL = 'https://www.brvm.org/sites/default/files';

const TIMEOUT_MS = 30_000;
/** A BOC is about 1 MB; anything far larger is not one. */
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Downloads a BOC from the BRVM's public website.
 *
 * Bulletins are published as `<files>/boc_YYYYMMDD_2.pdf`, but the suffix
 * varies (`boc_YYYYMMDD.pdf`, `boc_YYYYMMDD_2_0.pdf` are seen too), so the
 * fetcher first looks for the day's link on the listing page, then falls
 * back to the usual names. Both URLs are configurable (BOC_LISTING_URL,
 * BOC_FILES_URL) in case the site moves.
 */
@Injectable()
export class HttpBocFetcher implements BocFetcher {
  private readonly logger = new Logger(HttpBocFetcher.name);
  private readonly listingUrl: string;
  private readonly filesUrl: string;

  constructor(config: ConfigService) {
    this.listingUrl = config.get<string>(
      'BOC_LISTING_URL',
      DEFAULT_BOC_LISTING_URL,
    );
    this.filesUrl = config
      .get<string>('BOC_FILES_URL', DEFAULT_BOC_FILES_URL)
      .replace(/\/+$/, '');
  }

  async fetch(tradingDate: string): Promise<FetchedBoc | null> {
    for (const url of await this.candidateUrls(tradingDate)) {
      const document = await this.download(url);
      if (document) return { document, sourceUrl: url };
    }
    return null;
  }

  private async candidateUrls(tradingDate: string): Promise<string[]> {
    const day = tradingDate.replace(/-/g, '');
    const listed = await this.listedUrls(day);
    const usual = [`boc_${day}_2.pdf`, `boc_${day}.pdf`].map(
      (name) => `${this.filesUrl}/${name}`,
    );
    return [...new Set([...listed, ...usual])];
  }

  /** Links to that day's bulletin on the listing page, if it can be read. */
  private async listedUrls(day: string): Promise<string[]> {
    try {
      const response = await fetch(this.listingUrl, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) return [];
      return bocLinksFor(await response.text(), day, this.listingUrl);
    } catch (error) {
      this.logger.warn(
        `Could not read the BOC listing: ${(error as Error).message}`,
      );
      return [];
    }
  }

  private download(url: string): Promise<Buffer | null> {
    return downloadBoc(url, this.logger);
  }
}

/**
 * Bulletins of past days, straight from where the BRVM keeps its files (the
 * listing page only shows recent ones). Old bulletins are named
 * `boc_YYYYMMDD.pdf` up to 2021 and `boc_YYYYMMDD_2.pdf` since, so the likelier
 * name is tried first. Waits `pauseMs` before every request, to be polite to
 * brvm.org during a long backfill. A request that fails on the network (not a
 * 404) is tried once more; a day that still failed is remembered in
 * `downloadErrors`, so the report does not mistake it for a day without a
 * bulletin (running the backfill again retries it).
 */
export class ArchivedBocFetcher implements BocFetcher {
  private readonly logger = new Logger(ArchivedBocFetcher.name);
  private readonly filesUrl: string;
  /** Requests made, for the backfill report. */
  requests = 0;
  /** Days whose download failed on the network, not with a 404. */
  readonly downloadErrors = new Set<string>();

  constructor(
    filesUrl: string = DEFAULT_BOC_FILES_URL,
    private readonly pauseMs = 2000,
  ) {
    this.filesUrl = filesUrl.replace(/\/+$/, '');
  }

  async fetch(tradingDate: string): Promise<FetchedBoc | null> {
    const day = tradingDate.replace(/-/g, '');
    const names = [`boc_${day}.pdf`, `boc_${day}_2.pdf`];
    if (tradingDate >= '2022') names.reverse();
    for (const name of names) {
      const url = `${this.filesUrl}/${name}`;
      for (let attempt = 1; attempt <= 2; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, this.pauseMs));
        this.requests++;
        const failed = { network: false };
        const document = await downloadBoc(url, this.logger, failed);
        if (document) {
          this.downloadErrors.delete(tradingDate);
          return { document, sourceUrl: url };
        }
        if (!failed.network) break;
        this.downloadErrors.add(tradingDate);
      }
    }
    return null;
  }
}

/** A BOC PDF from a URL, or null when it is not there or not a PDF. */
async function downloadBoc(
  url: string,
  logger: Logger,
  failed: { network: boolean } = { network: false },
): Promise<Buffer | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > MAX_BYTES) return null;
    const document = Buffer.from(await response.arrayBuffer());
    if (document.length > MAX_BYTES || !isPdf(document)) return null;
    return document;
  } catch (error) {
    failed.network = true;
    logger.warn(`Could not download ${url}: ${(error as Error).message}`);
    return null;
  }
}

/** Absolute URLs of the links to a day's BOC PDF found in a listing page. */
export function bocLinksFor(html: string, day: string, base: string): string[] {
  const links = new Set<string>();
  const href = /href="([^"]*\/boc_(\d{8})(?:_\w+)?\.pdf)"/gi;
  for (const match of html.matchAll(href)) {
    if (match[2] === day) links.add(new URL(match[1], base).toString());
  }
  return [...links];
}

const isPdf = (bytes: Buffer) =>
  bytes.subarray(0, 5).toString('latin1') === '%PDF-';
