import {
  BackfillDayOutcome,
  type BackfillSummary,
  groupFailures,
} from './boc-backfill.service';

export interface BackfillCounts {
  weekdays: number;
  imported: number;
  held: number;
  notFound: number;
  alreadyStored: number;
  /** Days read, by layout. */
  layouts: Record<string, number>;
}

export function countBackfill(summary: BackfillSummary): BackfillCounts {
  const count = (outcome: BackfillDayOutcome) =>
    summary.days.filter((d) => d.outcome === outcome).length;
  const layouts: Record<string, number> = {};
  for (const day of summary.days) {
    if (day.layout) layouts[day.layout] = (layouts[day.layout] ?? 0) + 1;
  }
  return {
    weekdays: summary.days.length,
    imported: count(BackfillDayOutcome.IMPORTED),
    held: count(BackfillDayOutcome.HELD),
    notFound: count(BackfillDayOutcome.NOT_FOUND),
    alreadyStored: count(BackfillDayOutcome.ALREADY_STORED),
    layouts,
  };
}

/**
 * The backfill report, as Markdown: what was imported, held (grouped by
 * reason) and not found, the layouts read and the securities not stored.
 */
export function renderBackfillReport(
  summary: BackfillSummary,
  meta: {
    title: string;
    from: string;
    to: string;
    generatedAt: string;
    /** The periods covered, when not the whole span from..to. */
    ranges?: string[];
  },
): string {
  const counts = countBackfill(summary);
  const held = summary.days.filter(
    (d) => d.outcome === BackfillDayOutcome.HELD,
  );
  const notFound = summary.days.filter(
    (d) => d.outcome === BackfillDayOutcome.NOT_FOUND,
  );
  const lines = [
    `# ${meta.title}`,
    '',
    `Weekdays ${meta.ranges ? meta.ranges.join(', ') : `${meta.from} to ${meta.to}`}; generated ${meta.generatedAt} by \`pnpm --filter doni-backend backfill:boc\`.`,
    '',
    '| | Days |',
    '| --- | ---: |',
    `| Weekdays considered | ${counts.weekdays} |`,
    `| Imported (every check passed) | ${counts.imported} |`,
    `| Held for review (pending_review) | ${counts.held} |`,
    `| No bulletin found | ${counts.notFound} |`,
    `| Already stored by the daily ingestion | ${counts.alreadyStored} |`,
    '',
    '## Layouts read',
    '',
    ...(Object.keys(counts.layouts).length === 0
      ? ['None.']
      : Object.entries(counts.layouts)
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([layout, n]) => `- ${layout}: ${n} day(s)`)),
    '',
    '## Days held, by reason',
    '',
  ];
  if (held.length === 0) lines.push('None.');
  for (const group of groupFailures(held)) {
    lines.push(
      `- **${group.check}**: ${group.days.length} day(s) (${group.days.join(', ')}). E.g. ${group.example}`,
    );
  }
  lines.push('', '## Days without a bulletin', '');
  lines.push(
    notFound.length === 0
      ? 'None.'
      : `${notFound.length} weekday(s), BRVM holidays or bulletins not online: ${notFound.map((d) => d.tradingDate).join(', ')}.`,
  );
  lines.push('', '## Listed securities not in the catalogue', '');
  lines.push(
    summary.uncatalogued.size === 0
      ? 'None.'
      : 'Their rows are read but not stored (delisted or renamed since, or not catalogued): ' +
          [...summary.uncatalogued.entries()]
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([ticker, n]) => `${ticker} (${n})`)
            .join(', ') +
          '.',
  );
  lines.push('');
  return lines.join('\n');
}
