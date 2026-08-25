import { describe, expect, it } from 'vitest';
import { resolveErrorCodeKey, translatableErrorCode } from './error-codes';

describe('resolveErrorCodeKey', () => {
  it('mapuje snake_case na klucz w scope shared', () => {
    expect(resolveErrorCodeKey('multimedia_still_referenced')).toBe(
      'shared.errors.codes.multimediaStillReferenced'
    );
  });

  it('zwraca null dla kodu bez tłumaczenia', () => {
    expect(resolveErrorCodeKey('brand_new_rule_without_translation')).toBeNull();
    expect(resolveErrorCodeKey(null)).toBeNull();
    expect(resolveErrorCodeKey('')).toBeNull();
  });

  it('podaje surowy kod, gdy tłumaczenia jeszcze nie ma', () => {
    expect(translatableErrorCode('brand_new_rule_without_translation')).toBe(
      'brand_new_rule_without_translation'
    );
  });
});
