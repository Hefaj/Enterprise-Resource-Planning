import { isSignal, Signal } from '@angular/core';

export type MaybeSignal<T> = T | Signal<T>;

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
