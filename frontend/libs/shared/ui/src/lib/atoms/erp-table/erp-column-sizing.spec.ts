import { describe, expect, it } from 'vitest';
import { ErpSizingColumn, erpFitColumnWidths, erpRescaleColumnWidths } from './erp-column-sizing';

function col(id: string, base: number, extra: Partial<ErpSizingColumn> = {}): ErpSizingColumn {
  return { id, base, min: 80, max: Number.POSITIVE_INFINITY, grow: 1, ...extra };
}

const total = (sizes: Map<string, number>) => [...sizes.values()].reduce((a, b) => a + b, 0);

describe('erpFitColumnWidths', () => {
  it('zostawia szerokości bez zmian, gdy kolumny się nie mieszczą (zostaje poziomy scroll)', () => {
    const columns = [col('a', 400), col('b', 500), col('c', 600)];
    const sizes = erpFitColumnWidths(columns, { viewport: 1000 });

    expect([...sizes.values()]).toEqual([400, 500, 600]);
  });

  it('zostawia szerokości bez zmian przed pierwszym pomiarem kontenera', () => {
    const sizes = erpFitColumnWidths([col('a', 90), col('b', 320)], { viewport: 0 });

    expect([...sizes.values()]).toEqual([90, 320]);
  });

  it('rozdziela lukę proporcjonalnie do zadeklarowanej szerokości', () => {
    // luka 590 px dzielona w proporcji 90 : 320 → ~130 : ~460
    const sizes = erpFitColumnWidths([col('id', 90), col('opis', 320)], { viewport: 1000 });

    expect(sizes.get('id')).toBe(220);
    expect(sizes.get('opis')).toBe(780);
    expect(total(sizes)).toBe(1000);
    // kolumna opisu dostaje z luki wyraźnie więcej niż kolumna identyfikatora
    expect(sizes.get('opis')! - 320).toBeGreaterThan((sizes.get('id')! - 90) * 3);
  });

  it('pomija kolumny z grow: 0 — ich szerokość zostaje nienaruszona', () => {
    const columns = [col('sel', 48, { min: 48, max: 48, grow: 0 }), col('status', 120, { grow: 0 }), col('nazwa', 200)];
    const sizes = erpFitColumnWidths(columns, { viewport: 800 });

    expect(sizes.get('sel')).toBe(48);
    expect(sizes.get('status')).toBe(120);
    expect(sizes.get('nazwa')).toBe(632);
    expect(total(sizes)).toBe(800);
  });

  it('respektuje maxSize, a odcięty nadmiar oddaje pozostałym kolumnom', () => {
    const columns = [col('a', 200, { max: 250 }), col('b', 200)];
    const sizes = erpFitColumnWidths(columns, { viewport: 1000 });

    expect(sizes.get('a')).toBe(250);
    expect(sizes.get('b')).toBe(750);
    expect(total(sizes)).toBe(1000);
  });

  it('zostawia lukę, gdy wszystkie kolumny uderzyły w maxSize', () => {
    const columns = [col('a', 200, { max: 250 }), col('b', 200, { max: 250 })];
    const sizes = erpFitColumnWidths(columns, { viewport: 1000 });

    expect([...sizes.values()]).toEqual([250, 250]);
  });

  it('wyłącza z podziału kolumny ustawione ręcznie', () => {
    const columns = [col('a', 200), col('b', 200), col('c', 200)];
    const sizes = erpFitColumnWidths(columns, { viewport: 900, manuallyResized: new Set(['a']) });

    expect(sizes.get('a')).toBe(200);
    expect(sizes.get('b')).toBe(350);
    expect(sizes.get('c')).toBe(350);
    expect(total(sizes)).toBe(900);
  });

  it('rozciąga również kolumny ręczne, gdy wszystkie są ręczne (lepiej niż zostawić lukę)', () => {
    const columns = [col('a', 200), col('b', 200)];
    const sizes = erpFitColumnWidths(columns, { viewport: 600, manuallyResized: new Set(['a', 'b']) });

    expect(total(sizes)).toBe(600);
  });

  it('domyka `base` przez min i max przed podziałem', () => {
    const columns = [col('a', 20, { min: 100 }), col('b', 900, { max: 400, grow: 0 })];
    const sizes = erpFitColumnWidths(columns, { viewport: 1000 });

    expect(sizes.get('b')).toBe(400);
    expect(sizes.get('a')).toBe(600);
  });

  it('wypełnia kontener co do piksela mimo zaokrągleń', () => {
    const columns = [col('a', 100), col('b', 100), col('c', 100)];

    for (const viewport of [781, 999, 1001, 1279, 1337, 1920]) {
      expect(total(erpFitColumnWidths(columns, { viewport }))).toBe(viewport);
    }
  });

  it('nie oddaje reszty z zaokrągleń kolumnie, która nie może jej przyjąć', () => {
    const columns = [col('sel', 48, { min: 48, max: 48, grow: 0 }), col('a', 101), col('b', 101)];
    const sizes = erpFitColumnWidths(columns, { viewport: 777 });

    expect(sizes.get('sel')).toBe(48);
    expect(total(sizes)).toBe(777);
  });
});

describe('erpRescaleColumnWidths', () => {
  const columns = [col('a', 300), col('b', 300)];

  it('skaluje w dół układ, który mieścił się w szerszym oknie', () => {
    const rescaled = erpRescaleColumnWidths(columns, { a: 400, b: 800 }, 1200, 900);

    expect(rescaled).toEqual({ a: 300, b: 600 });
  });

  it('nie rusza układu, który już wcześniej wychodził poza okno (świadomy scroll)', () => {
    expect(erpRescaleColumnWidths(columns, { a: 900, b: 900 }, 1200, 900)).toBeNull();
  });

  it('nie skaluje w górę — od tego jest rozdział wolnej przestrzeni', () => {
    expect(erpRescaleColumnWidths(columns, { a: 400, b: 400 }, 1000, 1600)).toBeNull();
  });

  it('nie schodzi poniżej minimalnej szerokości kolumny', () => {
    const rescaled = erpRescaleColumnWidths([col('a', 100, { min: 80 })], { a: 100 }, 1600, 400);

    expect(rescaled).toEqual({ a: 80 });
  });

  it('zwraca null przy braku zapisanej lub bieżącej szerokości', () => {
    expect(erpRescaleColumnWidths(columns, { a: 400 }, 0, 900)).toBeNull();
    expect(erpRescaleColumnWidths(columns, { a: 400 }, 1200, 0)).toBeNull();
  });
});
