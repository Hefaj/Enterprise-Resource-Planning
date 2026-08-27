import { describe, expect, it } from 'vitest';
import { resolveErrorCodeKey, translatableErrorCode } from './error-codes';

describe('resolveErrorCodeKey', () => {
  it('mapuje snake_case na klucz w scope shared', () => {
    expect(resolveErrorCodeKey('multimedia_still_referenced')).toBe(
      'shared.errors.codes.multimediaStillReferenced'
    );
  });

  it('traktuje prefiks modułu jak kolejny segment nazwy', () => {
    // Task Management prefiksuje kody nazwą modułu (docs/backend/task-management.md §2),
    // a rejestr kluczy zostaje płaski — bez tego kropka przechodziłaby przez camelCase
    // i lookup nigdy by nie trafił.
    expect(resolveErrorCodeKey('taskmgmt.transition_not_allowed')).toBe(
      'shared.errors.codes.taskmgmtTransitionNotAllowed'
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
