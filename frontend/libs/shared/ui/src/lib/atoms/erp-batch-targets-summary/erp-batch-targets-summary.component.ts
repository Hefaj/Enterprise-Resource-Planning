import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpBatchTargetsSummaryConfig } from './erp-batch-targets-summary.types';

/**
 * Podsumowanie celów kroku modalu operacji masowej.
 *
 * Renderuje jeden z trzech stanów, zależnie od `ErpBatchStepBase` — wszystkie w tym samym
 * stylu boksu co `erp-selection-scope-banner` (patrz `docs/guides/frontend/selection-scope.md`),
 * żeby "zdanie o zasięgu" wyglądało identycznie niezależnie od tego, czy stoi nad panelem,
 * czy w kroku modalu:
 * - tryb filtra ("Zaznacz wszystko") — wariant ostrzegawczy: komunikat + opis (cele wyznaczy
 *   backend, frontend ich nie zna),
 * - dokładnie jeden jawny cel — wariant spokojny: komunikat + nazwa tej jednej pozycji
 *   (konkretna nazwa mówi więcej niż "1 produkt"),
 * - więcej niż jeden jawny cel — wariant spokojny: komunikat + sama liczba, bez wyliczania
 *   nazw (nie jako osobne kolorowe "dropsy" — te utrudniały skanowanie przy kilkunastu pozycjach),
 * - brak celów — opcjonalny `emptyKey` (pominięty — nic się nie renderuje).
 *
 * Zastępuje ręcznie pisany blok `@if (isFilterMode()) {...} @else if (...) {...}`
 * powtarzany dotąd w każdym kroku modalu wsadowego — krok modalu składa tylko
 * konfigurację przez `ErpBatchTargetsSummaryBuilder` i dodaje ją do `ErpStepContentBuilder`
 * przez `.addComponent(ErpBatchTargetsSummaryComponent, { config })`.
 */
@Component({
  selector: 'erp-batch-targets-summary',
  standalone: true,
  imports: [ErpTranslatePipe],
  template: `
    @if (isFilterMode()) {
      <div class="erp-batch-targets-summary__scope-banner">
        <span class="erp-batch-targets-summary__scope-banner-title">
          {{ messageKey() | erpTranslate }}
          <strong> {{ targetCount() }} </strong>
          {{ (targetCount() === 1 ? suffixSingleKey() : suffixPluralKey()) | erpTranslate }}
          {{ filterModeSuffixKey() | erpTranslate }}
        </span>
        @if (filterModeHintKey()) {
          <p class="erp-batch-targets-summary__scope-banner-description">
            {{ filterModeHintKey() | erpTranslate }}
          </p>
        }
      </div>
    } @else if (items().length === 1) {
      <div class="erp-batch-targets-summary__scope-banner erp-batch-targets-summary__scope-banner--calm">
        <span class="erp-batch-targets-summary__scope-banner-title">
          {{ messageKey() | erpTranslate }}
          @if (singleItemLabel(); as label) {
            {{ label }}
          } @else if (loadingKey()) {
            {{ loadingKey() | erpTranslate }}
          }
        </span>
      </div>
    } @else if (items().length > 1) {
      <div class="erp-batch-targets-summary__scope-banner erp-batch-targets-summary__scope-banner--calm">
        <span class="erp-batch-targets-summary__scope-banner-title">
          {{ messageKey() | erpTranslate }}
          <strong> {{ items().length }} </strong>
          {{ suffixPluralKey() | erpTranslate }}
        </span>
      </div>
    } @else if (emptyKey()) {
      <p class="erp-batch-targets-summary__empty">
        {{ emptyKey() | erpTranslate }}
      </p>
    }
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .erp-batch-targets-summary__empty { margin: 0; color: var(--tui-status-warning); }

    /* Ten sam wygląd co erp-selection-scope-banner — "zdanie o zasięgu" ma być
       rozpoznawalne wizualnie niezależnie od tego, czy stoi nad panelem, czy w kroku modalu. */
    .erp-batch-targets-summary__scope-banner {
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid color-mix(in srgb, var(--tui-status-warning) 35%, transparent);
      background: color-mix(in srgb, var(--tui-status-warning) 8%, var(--tui-background-base));
      color: var(--tui-text-primary);
      font: var(--tui-font-text-s);
    }
    .erp-batch-targets-summary__scope-banner--calm {
      border-color: color-mix(in srgb, var(--tui-text-action) 30%, transparent);
      background: color-mix(in srgb, var(--tui-text-action) 6%, var(--tui-background-base));
    }
    .erp-batch-targets-summary__scope-banner-title { font-weight: 500; }
    .erp-batch-targets-summary__scope-banner-description {
      margin: 0.25rem 0 0;
      color: var(--tui-text-secondary);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpBatchTargetsSummaryComponent {
  public config = input.required<ErpBatchTargetsSummaryConfig>();

  /**
   * `items`/`targetCount`/`isFilterMode` przyjmują też zwykły getter (nie tylko `Signal`) —
   * config jest budowany zanim `super()` kroku modalu zainicjalizuje pola bazy, więc
   * `unwrapSignal` (rozpoznaje tylko prawdziwe `Signal`) by ich nie wywołał.
   */
  private resolveDeferred<T>(value: T | (() => T) | undefined): T | undefined {
    return typeof value === 'function' ? (value as () => T)() : value;
  }

  protected readonly items = computed(() => this.resolveDeferred(this.config().items) ?? []);
  /** Nazwa jedynego celu przy dokładnie jednej pozycji — konkretna nazwa mówi więcej niż "1 produkt". */
  protected readonly singleItemLabel = computed(() => this.items()[0]?.label ?? null);
  protected readonly targetCount = computed(() => this.resolveDeferred(this.config().targetCount) ?? 0);
  protected readonly isFilterMode = computed(() => this.resolveDeferred(this.config().isFilterMode) ?? false);
  protected readonly messageKey = computed(() => unwrapSignal(this.config().messageKey));
  protected readonly suffixSingleKey = computed(() => unwrapSignal(this.config().suffixSingleKey));
  protected readonly suffixPluralKey = computed(() => unwrapSignal(this.config().suffixPluralKey));
  protected readonly filterModeSuffixKey = computed(() => unwrapSignal(this.config().filterModeSuffixKey));
  protected readonly filterModeHintKey = computed(() => unwrapSignal(this.config().filterModeHintKey));
  protected readonly emptyKey = computed(() => unwrapSignal(this.config().emptyKey));
  protected readonly loadingKey = computed(() => unwrapSignal(this.config().loadingKey));
}
