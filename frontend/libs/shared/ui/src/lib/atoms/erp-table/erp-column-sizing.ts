/**
 * Dopasowanie szerokości kolumn do szerokości tabeli.
 *
 * Reguła: gdy kolumny nie wypełniają dostępnej szerokości, nadmiar rozdzielany jest
 * proporcjonalnie do `grow * size`, z poszanowaniem `maxSize`. Gdy się nie mieszczą —
 * nie robimy nic i zostaje poziomy scroll.
 *
 * Wagą podziału jest sama zadeklarowana szerokość kolumny, bo to ona już niesie informację
 * o tym, ile treści kolumna mieści: kolumna opisu (`setSize(320)`) dostaje z luki ~3.5x więcej
 * niż kolumna identyfikatora (`setSize(90)`). Dzięki temu typowa tabela nie wymaga żadnej
 * dodatkowej konfiguracji, a `grow` zostaje jako furtka dla przypadków, w których szerokość
 * bazowa nie oddaje potencjału wzrostu.
 *
 * Efektem jest niezmiennik: nigdy nie ma luki po prawej, a scroll pojawia się wyłącznie
 * przy realnym braku miejsca.
 */

/** Kolumna sprowadzona do samych parametrów szerokości — wejście algorytmu dopasowania. */
export interface ErpSizingColumn {
  id: string;
  /** Szerokość bazowa: `size` z definicji kolumny albo ręczne ustawienie użytkownika. */
  base: number;
  min: number;
  /** `Number.POSITIVE_INFINITY`, gdy kolumna nie ma górnego ograniczenia. */
  max: number;
  /** Waga udziału w rozdziale wolnej przestrzeni; 0 = kolumna nie rośnie. */
  grow: number;
}

export interface ErpFitColumnWidthsOptions {
  /** Szerokość obszaru roboczego tabeli w px. 0 (brak pomiaru) = zwracamy szerokości bazowe. */
  viewport: number;
  /**
   * Kolumny ustawione ręcznie przez użytkownika — wyłączone z rozdziału wolnej przestrzeni.
   * Ręczna szerokość to jawna decyzja; lukę po zwężeniu takiej kolumny mają zasypać pozostałe,
   * a nie ona sama — inaczej przeciąganie sprężynowałoby w tył.
   */
  manuallyResized?: ReadonlySet<string>;
}

/**
 * Zwraca ostateczne szerokości kolumn (w pełnych pikselach) dla zadanej szerokości tabeli.
 * Wejściowe `base` jest już domknięte przez `min`/`max`.
 */
export function erpFitColumnWidths(
  columns: readonly ErpSizingColumn[],
  { viewport, manuallyResized }: ErpFitColumnWidthsOptions,
): Map<string, number> {
  const sizes = new Map<string, number>();
  let total = 0;

  for (const col of columns) {
    const size = Math.min(Math.max(col.base, col.min), col.max);
    sizes.set(col.id, size);
    total += size;
  }

  if (viewport <= 0 || total >= viewport) return sizes;

  distributeSlack(columns, sizes, viewport - total, manuallyResized ?? new Set<string>());
  roundToWholePixels(columns, sizes, viewport);

  return sizes;
}

/**
 * Rozdziela `slack` px między kolumny, które mogą rosnąć — proporcjonalnie do `grow * size`.
 * Kolumna, która trafi w swój `max`, wypada z puli, a jej nieodebrana część wraca do podziału
 * (water-filling — ten sam schemat co `flex-grow` z `max-width`).
 */
function distributeSlack(
  columns: readonly ErpSizingColumn[],
  sizes: Map<string, number>,
  slack: number,
  manuallyResized: ReadonlySet<string>,
): void {
  const canGrow = (col: ErpSizingColumn) => col.grow > 0 && sizes.get(col.id)! < col.max - 0.5;

  let pool = columns.filter(col => canGrow(col) && !manuallyResized.has(col.id));
  // Gdy użytkownik ustawił ręcznie wszystkie kolumny, nie ma komu oddać luki — lepiej wtedy
  // rozciągnąć również te ręczne niż zostawić pustą przestrzeń po prawej.
  if (pool.length === 0) pool = columns.filter(canGrow);

  let remaining = slack;

  while (remaining > 0.5 && pool.length > 0) {
    const totalWeight = pool.reduce((acc, col) => acc + col.grow * sizes.get(col.id)!, 0);
    if (totalWeight <= 0) break;

    const next: ErpSizingColumn[] = [];
    let distributed = 0;

    for (const col of pool) {
      const current = sizes.get(col.id)!;
      const share = (remaining * col.grow * current) / totalWeight;
      const applied = Math.min(share, col.max - current);
      sizes.set(col.id, current + applied);
      distributed += applied;
      if (col.max - (current + applied) > 0.5) next.push(col);
    }

    // Brak postępu (same kolumny na maksimum) — dalsze iteracje niczego nie zmienią.
    if (distributed < 0.5) break;
    remaining -= distributed;
    pool = next;
  }
}

/**
 * Sprowadza szerokości do pełnych pikseli i dokłada resztę z zaokrągleń do najszerszej kolumny,
 * która ma jeszcze zapas — inaczej po prawej zostaje subpikselowa szczelina albo pojawia się
 * poziomy scroll na ułamek piksela.
 */
function roundToWholePixels(
  columns: readonly ErpSizingColumn[],
  sizes: Map<string, number>,
  viewport: number,
): void {
  let total = 0;

  for (const col of columns) {
    const rounded = Math.round(sizes.get(col.id)!);
    sizes.set(col.id, rounded);
    total += rounded;
  }

  const diff = viewport - total;
  if (diff === 0) return;

  const target = columns
    .filter(col => {
      const adjusted = sizes.get(col.id)! + diff;
      return col.grow > 0 && adjusted >= col.min && adjusted <= col.max;
    })
    .sort((a, b) => sizes.get(b.id)! - sizes.get(a.id)!)[0];

  if (target) sizes.set(target.id, sizes.get(target.id)! + diff);
}

/**
 * Skaluje w dół szerokości odtworzone z preferencji, gdy okno jest węższe niż to, na którym
 * układ powstał. Szerszego okna nie ruszamy — tym zajmuje się `erpFitColumnWidths`, i robi to
 * lepiej, bo respektuje `grow: 0`.
 *
 * Skalujemy wyłącznie układ, który wtedy mieścił się w oknie. Jeśli już wówczas z niego
 * wychodził, użytkownik świadomie wybrał poziomy scroll i ściśnięcie kolumn zniszczyłoby
 * jego układ. `null` = nie ma czego zmieniać.
 */
export function erpRescaleColumnWidths(
  columns: readonly ErpSizingColumn[],
  declared: Readonly<Record<string, number>>,
  savedViewport: number,
  viewport: number,
): Record<string, number> | null {
  if (savedViewport <= 0 || viewport <= 0 || viewport >= savedViewport) return null;

  const savedTotal = columns.reduce((acc, col) => acc + (declared[col.id] ?? col.base), 0);
  if (savedTotal > savedViewport + 1) return null;

  const ratio = viewport / savedViewport;
  const rescaled: Record<string, number> = { ...declared };

  for (const col of columns) {
    const size = declared[col.id];
    if (size === undefined) continue;
    rescaled[col.id] = Math.max(col.min, Math.round(size * ratio));
  }

  return rescaled;
}
