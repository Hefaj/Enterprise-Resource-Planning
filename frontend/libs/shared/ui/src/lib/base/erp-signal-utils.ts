import { DestroyRef, inject, isSignal, Signal, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

export type MaybeSignal<T> = T | Signal<T>;

export type Translatable = string | { key: string; params?: Record<string, any> };

/**
 * Unwraps a value that can be either a static value or an Angular Signal.
 * @param value The value to unwrap.
 * @returns The unwrapped value.
 */
export function unwrapSignal<T>(value: MaybeSignal<T> | undefined): T | undefined {
  if (isSignal(value)) {
    return value();
  }
  return value;
}

/**
 * `TranslocoService.translate()` is not signal-reactive — it just reads whatever is currently
 * loaded. A `computed()` that calls it directly caches the raw key forever if it happens to be
 * read before the scope's translation JSON finishes loading. Read the signal this returns at the
 * top of any such `computed()` to force it to re-run once translations (or the language) change.
 */
export function injectTranslationsReadySignal(): Signal<number> {
  const transloco = inject(TranslocoService);
  const destroyRef = inject(DestroyRef);
  const tick = signal(0);

  const subscription = transloco.events$.subscribe((event) => {
    if (event.type === 'translationLoadSuccess' || event.type === 'langChanged') {
      tick.update((value) => value + 1);
    }
  });
  destroyRef.onDestroy(() => subscription.unsubscribe());

  return tick.asReadonly();
}
