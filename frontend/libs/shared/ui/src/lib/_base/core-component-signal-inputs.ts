import { InputSignal, ModelSignal } from '@angular/core';

export type EComponentSignalInputs<C> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in keyof C as C[K] extends InputSignal<any> | ModelSignal<any> ? K : never]?: C[K] extends InputSignal<infer T>
    ? T
    : C[K] extends ModelSignal<infer M>
      ? M
      : never;
};
