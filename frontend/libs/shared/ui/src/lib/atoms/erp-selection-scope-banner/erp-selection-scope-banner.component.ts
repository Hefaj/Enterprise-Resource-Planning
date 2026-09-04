import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { SHARED_KEYS } from '../../translation/keys';
import { ErpSelectionScopeBannerConfig } from './erp-selection-scope-banner.types';

/**
 * ErpSelectionScopeBanner — „zdanie o zasięgu" nad panelem zależnym od zaznaczenia.
 *
 * Promień rażenia akcji masowych musi być widoczny bez klikania: gdy zaznaczenie jest
 * filtrem (`query`), panel pokazuje jedynie próbkę, więc baner jawnie oznacza ją jako
 * próbkę i mówi, że akcje obejmą cały pasujący zbiór. Po materializacji „Zaznacz wszystko"
 * do listy identyfikatorów baner tylko spokojnie potwierdza liczbę pozycji.
 *
 * Patrz `docs/guides/frontend/selection-scope.md`.
 */
@Component({
  selector: 'erp-selection-scope-banner',
  standalone: true,
  imports: [ErpTranslatePipe],
  template: `
    @if (_kind() === 'query') {
      <div class="erp-selection-scope-banner">
        <span class="erp-selection-scope-banner__title">
          {{ _previewTitle() | erpTranslate: { shown: _shownCount(), count: _count() } }}
        </span>
        @if (_previewDescription()) {
          <p class="erp-selection-scope-banner__description">
            {{ _previewDescription() | erpTranslate }}
          </p>
        }
      </div>
    } @else if (_showMaterializedBanner()) {
      <div class="erp-selection-scope-banner erp-selection-scope-banner--calm">
        {{ _allTitle() | erpTranslate: { count: _count() } }}
      </div>
    }
  `,
  styles: [`
    .erp-selection-scope-banner {
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid color-mix(in srgb, var(--tui-status-warning) 35%, transparent);
      background: color-mix(in srgb, var(--tui-status-warning) 8%, var(--tui-background-base));
      color: var(--tui-text-primary);
      font: var(--tui-font-text-s);
    }

    .erp-selection-scope-banner--calm {
      border-color: color-mix(in srgb, var(--tui-text-action) 30%, transparent);
      background: color-mix(in srgb, var(--tui-text-action) 6%, var(--tui-background-base));
    }

    .erp-selection-scope-banner__title {
      font-weight: 500;
    }

    .erp-selection-scope-banner__description {
      margin-top: 0.25rem;
      color: var(--tui-text-secondary);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpSelectionScopeBannerComponent {
  public readonly config = input.required<ErpSelectionScopeBannerConfig>();

  private readonly _scope = computed(() => unwrapSignal(this.config().scope) ?? { kind: 'none' as const });

  protected readonly _kind = computed(() => this._scope().kind);

  protected readonly _count = computed(() => {
    const scope = this._scope();
    return scope.kind === 'none' ? 0 : scope.count;
  });

  protected readonly _shownCount = computed(() => unwrapSignal(this.config().shownCount) ?? 0);

  /** Komunikat „zaznaczono wszystkie N" należy się wyłącznie zaznaczeniu zmaterializowanemu. */
  protected readonly _showMaterializedBanner = computed(() => {
    const scope = this._scope();
    if (scope.kind !== 'explicit' || !scope.materialized) return false;
    return unwrapSignal(this.config().showMaterialized) ?? true;
  });

  protected readonly _previewTitle = computed(
    () => unwrapSignal(this.config().previewTitle) ?? SHARED_KEYS.selectionScope.previewTitle,
  );

  protected readonly _previewDescription = computed(
    () => unwrapSignal(this.config().previewDescription) ?? SHARED_KEYS.selectionScope.previewDescription,
  );

  protected readonly _allTitle = computed(
    () => unwrapSignal(this.config().allTitle) ?? SHARED_KEYS.selectionScope.allTitle,
  );
}
