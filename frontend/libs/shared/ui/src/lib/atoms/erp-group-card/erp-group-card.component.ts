import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { TuiIcon, TuiButton } from '@taiga-ui/core';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpGroupCardConfig } from './erp-group-card.types';

/**
 * Reużywalny card z nagłówkiem i slotowaną treścią.
 *
 * Wizualny kontener grupujący — np. multimedia jednego produktu,
 * tabela szczegółów, lista powiązanych elementów.
 *
 * Features:
 * - Nagłówek: ikona + tytuł/podtytuł + expand toggle + akcje
 * - Collapse/expand z animacją
 * - Skeleton loader gdy `loading === true`
 * - Placeholder height dla wirtualizacji
 * - Treść przez `<ng-content>`
 */
@Component({
  selector: 'erp-group-card',
  standalone: true,
  imports: [TuiIcon, TuiButton, ErpTranslatePipe],
  template: `
    <div
      class="erp-group-card"
      [class.erp-group-card--selected]="_selected()"
      [class.erp-group-card--collapsed]="!_isExpanded()"
    >
      <!-- Header -->
      <div class="erp-group-card__header" (click)="toggleExpanded()">
        @if (_icon()) {
          <tui-icon [icon]="_icon()!" class="erp-group-card__icon" />
        }

        <div class="erp-group-card__titles">
          <span class="erp-group-card__title">
            {{ (_title() | erpTranslate) || '' }}
          </span>
          @if (_subtitle()) {
            <span class="erp-group-card__subtitle">
              {{ (_subtitle() | erpTranslate) || '' }}
            </span>
          }
        </div>

        <!-- Actions -->
        @if (_actions().length > 0) {
          <div class="erp-group-card__actions" (click)="$event.stopPropagation()">
            @for (action of _actions(); track action.label) {
              <button
                tuiButton
                type="button"
                appearance="flat"
                size="xs"
                [disabled]="_isActionDisabled(action)"
                (click)="onActionClick(action)"
              >
                @if (action.icon) {
                  <tui-icon [icon]="action.icon" />
                }
                {{ (action.label | erpTranslate) || '' }}
              </button>
            }
          </div>
        }

        <!-- Expand toggle -->
        <tui-icon
          icon="@tui.chevron-down"
          class="erp-group-card__chevron"
          [class.erp-group-card__chevron--rotated]="_isExpanded()"
        />
      </div>

      <!-- Content -->
      @if (_isExpanded()) {
        <div
          class="erp-group-card__body"
          [style.min-height.px]="_loading() ? _placeholderHeight() : 0"
        >
          @if (_loading()) {
            <div class="erp-group-card__skeleton">
              <div class="erp-group-card__skeleton-bar"></div>
              <div class="erp-group-card__skeleton-bar erp-group-card__skeleton-bar--short"></div>
              <div class="erp-group-card__skeleton-bar erp-group-card__skeleton-bar--medium"></div>
            </div>
          } @else {
            <ng-content />
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .erp-group-card {
      border: 1px solid var(--tui-border-normal);
      border-radius: 0.75rem;
      background: var(--tui-background-base);
      overflow: hidden;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .erp-group-card--selected {
      border-color: var(--tui-border-focus);
      box-shadow: 0 0 0 1px var(--tui-border-focus);
    }

    .erp-group-card__header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 0.75rem;
      cursor: pointer;
      user-select: none;
      transition: background-color 0.1s ease;
    }

    .erp-group-card__header:hover {
      background: var(--tui-background-neutral-1);
    }

    .erp-group-card__icon {
      flex-shrink: 0;
      color: var(--tui-text-secondary);
      font-size: 1.125rem;
    }

    .erp-group-card__titles {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .erp-group-card__title {
      font-weight: 600;
      font-size: 0.8125rem;
      line-height: 1.25rem;
      color: var(--tui-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .erp-group-card__subtitle {
      font-size: 0.6875rem;
      line-height: 1rem;
      color: var(--tui-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .erp-group-card__actions {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      flex-shrink: 0;
    }

    .erp-group-card__chevron {
      flex-shrink: 0;
      color: var(--tui-text-secondary);
      font-size: 1rem;
      transition: transform 0.2s ease;
      transform: rotate(-90deg);
    }

    .erp-group-card__chevron--rotated {
      transform: rotate(0deg);
    }

    .erp-group-card__body {
      padding: 0.75rem;
      border-top: 1px solid var(--tui-border-normal);
    }

    .erp-group-card--collapsed .erp-group-card__body {
      display: none;
    }

    /* Skeleton loader */
    .erp-group-card__skeleton {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.5rem 0;
    }

    .erp-group-card__skeleton-bar {
      height: 0.75rem;
      border-radius: 0.25rem;
      background: var(--tui-background-neutral-1);
      animation: erp-skeleton-pulse 1.5s ease-in-out infinite;
      width: 100%;
    }

    .erp-group-card__skeleton-bar--short {
      width: 40%;
    }

    .erp-group-card__skeleton-bar--medium {
      width: 70%;
    }

    @keyframes erp-skeleton-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpGroupCardComponent {
  /** Konfiguracja komponentu (z buildera lub obiektu). */
  public readonly config = input.required<ErpGroupCardConfig>();

  /** Wewnętrzny stan rozwinięcia. */
  private readonly _expandedInternal = signal<boolean | null>(null);

  // ── Rozpakowane wartości z config ──

  protected readonly _title = computed(() => unwrapSignal(this.config().title) ?? '');
  protected readonly _subtitle = computed(() => unwrapSignal(this.config().subtitle));
  protected readonly _icon = computed(() => unwrapSignal(this.config().icon));
  protected readonly _selected = computed(() => unwrapSignal(this.config().selected) ?? false);
  protected readonly _loading = computed(() => unwrapSignal(this.config().loading) ?? false);
  protected readonly _placeholderHeight = computed(() => unwrapSignal(this.config().placeholderHeight) ?? 100);
  protected readonly _actions = computed(() => this.config().actions ?? []);

  /** Efektywny stan rozwinięcia — wewnętrzny overriduje config. */
  protected readonly _isExpanded = computed(() => {
    const internal = this._expandedInternal();
    if (internal !== null) return internal;
    return unwrapSignal(this.config().expanded) ?? true;
  });

  /** Toggle rozwinięcia. */
  protected toggleExpanded(): void {
    const newState = !this._isExpanded();
    this._expandedInternal.set(newState);
    this.config().onToggle?.(newState);
  }

  /** Sprawdź czy akcja jest disabled. */
  protected _isActionDisabled(action: any): boolean {
    return unwrapSignal(action.disabled) ?? false;
  }

  /** Obsługa kliknięcia akcji (z obsługą async). */
  protected async onActionClick(action: any): Promise<void> {
    if (action.onClick) {
      await action.onClick();
    }
  }
}
