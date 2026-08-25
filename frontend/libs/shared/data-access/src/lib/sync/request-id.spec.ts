import { describe, expect, it } from 'vitest';
import { currentRequestId, withRequestId } from './request-id';

describe('withRequestId', () => {
  it('udostępnia identyfikator w trakcie synchronicznego wywołania', () => {
    expect(currentRequestId()).toBeNull();

    const seen = withRequestId(() => currentRequestId());

    expect(seen).not.toBeNull();
  });

  /**
   * Kluczowa własność: zakres kończy się razem z synchronicznym wykonaniem, a nie z obietnicą.
   * Gdyby identyfikator przeciekał dalej, następne żądanie — już innej operacji — pojechałoby
   * pod cudzym kluczem idempotencji i dostało cudzy wynik.
   */
  it('nie przecieka poza zakres', () => {
    withRequestId(() => currentRequestId());

    expect(currentRequestId()).toBeNull();
  });

  it('zwalnia zakres także wtedy, gdy operacja rzuci', () => {
    expect(() =>
      withRequestId(() => {
        throw new Error('bum');
      }),
    ).toThrow('bum');

    expect(currentRequestId()).toBeNull();
  });

  /**
   * Operacja złożona z kilku żądań (rejestracja plików → dopięcie ich do produktów) jest JEDNĄ
   * operacją: zagnieżdżenie zachowuje identyfikator zewnętrzny. Backend rozdziela te żądania,
   * dokładając do klucza nazwę operacji.
   */
  it('zagnieżdżenie zachowuje identyfikator zewnętrzny', () => {
    const { outer, inner } = withRequestId(() => ({
      outer: currentRequestId(),
      inner: withRequestId(() => currentRequestId()),
    }));

    expect(inner).toBe(outer);
  });

  it('kolejne operacje dostają różne identyfikatory', () => {
    const first = withRequestId(() => currentRequestId());
    const second = withRequestId(() => currentRequestId());

    expect(first).not.toBe(second);
  });
});
