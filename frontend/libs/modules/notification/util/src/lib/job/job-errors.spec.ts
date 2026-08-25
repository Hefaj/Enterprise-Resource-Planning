import { describe, expect, it } from 'vitest';
import { parseJobErrorsSummary } from './job-errors';

/**
 * Format wejścia jest kontraktem z `BulkCommandRunner.BuildErrorsSummaryAsync` — te testy
 * pilnują go po stronie klienta, bo zmiana po stronie backendu nie zapali się tutaj inaczej.
 */
describe('parseJobErrorsSummary', () => {
  it('zwraca pustą listę dla braku podsumowania', () => {
    expect(parseJobErrorsSummary(null)).toEqual([]);
    expect(parseJobErrorsSummary(undefined)).toEqual([]);
    expect(parseJobErrorsSummary('')).toEqual([]);
  });

  it('rozbiera pojedynczy kod', () => {
    expect(parseJobErrorsSummary('multimedia_still_referenced: 1')).toEqual([
      { code: 'multimedia_still_referenced', count: 1 },
    ]);
  });

  it('zachowuje kolejność wielu kodów', () => {
    expect(parseJobErrorsSummary('product_price_negative: 1200; product_name_empty: 3')).toEqual([
      { code: 'product_price_negative', count: 1200 },
      { code: 'product_name_empty', count: 3 },
    ]);
  });

  it('pomija fragmenty, których nie da się rozebrać', () => {
    expect(parseJobErrorsSummary('bez_liczby; product_name_empty: 3; : 9')).toEqual([
      { code: 'product_name_empty', count: 3 },
    ]);
  });
});
