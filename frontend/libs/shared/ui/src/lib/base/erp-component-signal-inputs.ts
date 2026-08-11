import { InputSignal, ModelSignal } from '@angular/core';

export type ErpComponentSignalInputs<C> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in keyof C as C[K] extends InputSignal<any> | ModelSignal<any> ? K : never]?: C[K] extends InputSignal<infer T>
    ? T
    : C[K] extends ModelSignal<infer M>
      ? M
      : never;
};

/**
 * Wyciąga typ wartości wejścia `config` komponentu pola formularza (kontrakt `config` + `control`,
 * wspólny dla wbudowanych i niestandardowych pól `erp-filter`/`erp-step-content`). W odróżnieniu od
 * `ErpComponentSignalInputs<C>` (która mapuje WSZYSTKIE inputy komponentu, w tym samo `config`,
 * dając zagnieżdżony `{ config?: X }`) zwraca bezpośrednio `X` — dokładnie to, co trafia do inputu
 * `config` przez `NgComponentOutlet` w szablonie panelu filtrów/kreatora.
 */
export type ErpFieldConfigInput<C> = C extends { config: InputSignal<infer T> }
  ? T
  : C extends { config: ModelSignal<infer T> }
    ? T
    : never;
