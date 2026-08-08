import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  inject,
  AfterViewInit,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TuiIcon, TuiDataList } from '@taiga-ui/core';
import { TuiLoader } from '@taiga-ui/core/components/loader';
import { TuiHintDirective } from '@taiga-ui/core/portals/hint';
import { ErpInputComponent, ErpInputBuilder } from '../../form/erp-input';
import { unwrapSignal, MaybeSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { TranslocoService } from '@jsverse/transloco';
import { SHARED_KEYS } from '../../translation/keys';
import {
  ErpActionDef,
  ErpActionGroup,
  ErpDynamicActionItem,
  ErpDynamicActionProvider,
} from './erp-action-toolbar.types';

/**
 * Wewnętrzny komponent Mega Menu.
 * Renderuje grupy akcji jako kolumny z wyszukiwarką na górze.
 */
@Component({
  selector: 'erp-action-toolbar-mega-menu',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TuiIcon,
    TuiDataList,
    TuiLoader,
    TuiHintDirective,
    ErpTranslatePipe,
    ErpInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="erp-mega-menu">
      <!-- Wyszukiwarka -->
      <div class="erp-mega-menu__search">
        <erp-input
          [config]="searchInputConfig"
          [ngModel]="searchTerm()"
          (ngModelChange)="searchTerm.set($event)"
        />
      </div>

      <!-- Kolumny grup -->
      @if (_hasAnyResults()) {
        <div class="erp-mega-menu__columns">
          @for (group of _filteredGroups(); track group.id) {
            <div class="erp-mega-menu__column">
              <!-- Nagłówek grupy -->
              <div class="erp-mega-menu__group-header">
                @if (unwrap(group.icon)) {
                  <tui-icon [icon]="unwrap(group.icon)!" class="erp-mega-menu__group-icon" />
                }
                <span class="erp-mega-menu__group-label">
                  {{ (unwrap(group.label) | erpTranslate) || '' }}
                </span>
                @if (group.isDynamic) {
                  <span class="erp-mega-menu__dynamic-badge">{{ (SHARED_KEYS.actionToolbar.megaMenu.dynamic | erpTranslate) || '' }}</span>
                }
              </div>

              <!-- Akcje statyczne -->
              <div class="erp-mega-menu__actions">
                @for (action of group.actions; track action.id) {
                  @if (!unwrap(action.hidden)) {
                    @if (action.separator) {
                      <hr class="erp-mega-menu__separator" />
                    }
                    @if (action.children && action.children.length > 0) {
                      <!-- Akcja z zagnieżdżonymi -->
                      <div class="erp-mega-menu__action-parent">
                        <button
                          class="erp-mega-menu__action"
                          [class.erp-mega-menu__action--disabled]="unwrap(action.disabled)"
                          [class.erp-mega-menu__action--warning]="unwrap(action.appearance) === 'warning'"
                          [class.erp-mega-menu__action--info]="unwrap(action.appearance) === 'info'"
                          [class.erp-mega-menu__action--success]="unwrap(action.appearance) === 'success'"
                          [disabled]="unwrap(action.disabled) ?? false"
                          (click)="onActionClick(action)"
                        >
                          @if (unwrap(action.icon)) {
                            <tui-icon [icon]="unwrap(action.icon)!" class="erp-mega-menu__action-icon" />
                          }
                          <span class="erp-mega-menu__action-label">
                            {{ (unwrap(action.label) | erpTranslate) || '' }}
                          </span>
                          @if (getEffectiveShortcut(action)) {
                            <kbd class="erp-mega-menu__shortcut">{{ getEffectiveShortcut(action) }}</kbd>
                          }
                        </button>
                        <!-- Zagnieżdżone dzieci wyświetlane inline -->
                        <div class="erp-mega-menu__children">
                          @for (child of action.children; track child.id) {
                            @if (!unwrap(child.hidden)) {
                              <button
                                class="erp-mega-menu__action erp-mega-menu__action--child"
                                [class.erp-mega-menu__action--disabled]="unwrap(child.disabled)"
                                [class.erp-mega-menu__action--warning]="unwrap(child.appearance) === 'warning'"
                                [class.erp-mega-menu__action--info]="unwrap(child.appearance) === 'info'"
                                [class.erp-mega-menu__action--success]="unwrap(child.appearance) === 'success'"
                                [disabled]="unwrap(child.disabled) ?? false"
                                (click)="onActionClick(child)"
                              >
                                @if (unwrap(child.icon)) {
                                  <tui-icon [icon]="unwrap(child.icon)!" class="erp-mega-menu__action-icon" />
                                }
                                <span class="erp-mega-menu__action-label">
                                  {{ (unwrap(child.label) | erpTranslate) || '' }}
                                </span>
                                @if (getEffectiveShortcut(child)) {
                                  <kbd class="erp-mega-menu__shortcut">{{ getEffectiveShortcut(child) }}</kbd>
                                }
                              </button>
                            }
                          }
                        </div>
                      </div>
                    } @else {
                      <!-- Akcja prosta -->
                      <button
                        class="erp-mega-menu__action"
                        [class.erp-mega-menu__action--disabled]="unwrap(action.disabled)"
                        [class.erp-mega-menu__action--warning]="unwrap(action.appearance) === 'warning'"
                        [class.erp-mega-menu__action--info]="unwrap(action.appearance) === 'info'"
                        [class.erp-mega-menu__action--success]="unwrap(action.appearance) === 'success'"
                        [disabled]="unwrap(action.disabled) ?? false"
                        (click)="onActionClick(action)"
                      >
                        <tui-loader
                          [loading]="isActionLoading(action)"
                          size="s"
                          [inheritColor]="true"
                          [overlay]="true"
                          class="erp-mega-menu__action-loader"
                        >
                          <div class="erp-mega-menu__action-content">
                            @if (unwrap(action.icon)) {
                              <tui-icon [icon]="unwrap(action.icon)!" class="erp-mega-menu__action-icon" />
                            }
                            <span class="erp-mega-menu__action-label">
                              {{ (unwrap(action.label) | erpTranslate) || '' }}
                            </span>
                            @if (getEffectiveShortcut(action)) {
                              <kbd class="erp-mega-menu__shortcut">{{ getEffectiveShortcut(action) }}</kbd>
                            }
                            @if (unwrap(action.hint)) {
                              <tui-icon
                                icon="@tui.info"
                                [tuiHint]="(unwrap(action.hint) | erpTranslate) || ''"
                                class="erp-mega-menu__hint-icon"
                                (click)="$event.stopPropagation()"
                              />
                            }
                          </div>
                        </tui-loader>
                      </button>
                    }
                  }
                }
              </div>
            </div>
          }

          <!-- Kolumny dynamicznych providerów -->
          @for (dp of _filteredDynamicProviders(); track dp.groupId) {
            <div class="erp-mega-menu__column">
              <div class="erp-mega-menu__group-header">
                @if (unwrap(dp.icon)) {
                  <tui-icon [icon]="unwrap(dp.icon)!" class="erp-mega-menu__group-icon" />
                }
                <span class="erp-mega-menu__group-label">
                  {{ (unwrap(dp.label) | erpTranslate) || '' }}
                </span>
                <span class="erp-mega-menu__dynamic-badge">{{ (SHARED_KEYS.actionToolbar.megaMenu.dynamic | erpTranslate) || '' }}</span>
              </div>

              <div class="erp-mega-menu__actions">
                @for (item of dp.items(); track item.id) {
                  <div class="erp-mega-menu__action-parent">
                    <div class="erp-mega-menu__dynamic-item-header">
                      @if (item.icon) {
                        <tui-icon [icon]="item.icon" class="erp-mega-menu__action-icon" />
                      }
                      <span class="erp-mega-menu__action-label erp-mega-menu__action-label--dynamic">
                        {{ item.label }}
                      </span>
                    </div>
                    <div class="erp-mega-menu__children">
                      @for (tmpl of dp.actionTemplate; track tmpl.id) {
                        <button
                          class="erp-mega-menu__action erp-mega-menu__action--child"
                          [class.erp-mega-menu__action--warning]="unwrap(tmpl.appearance) === 'warning'"
                          [class.erp-mega-menu__action--info]="unwrap(tmpl.appearance) === 'info'"
                          [class.erp-mega-menu__action--success]="unwrap(tmpl.appearance) === 'success'"
                          [disabled]="unwrap(tmpl.disabled) ?? false"
                          (click)="onDynamicActionClick(tmpl, item)"
                        >
                          @if (unwrap(tmpl.icon)) {
                            <tui-icon [icon]="unwrap(tmpl.icon)!" class="erp-mega-menu__action-icon" />
                          }
                          <span class="erp-mega-menu__action-label">
                            {{ (unwrap(tmpl.label) | erpTranslate) || '' }}
                          </span>
                        </button>
                      }
                    </div>
                  </div>
                }

                @if (dp.items().length === 0) {
                  <div class="erp-mega-menu__empty">{{ (SHARED_KEYS.actionToolbar.megaMenu.empty | erpTranslate) || '' }}</div>
                }
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="erp-mega-menu__empty-state">
          <tui-icon icon="@tui.search-x" class="erp-mega-menu__empty-icon" />
          <div class="erp-mega-menu__empty-text">
            {{ (SHARED_KEYS.actionToolbar.megaMenu.empty | erpTranslate) || '' }}
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .erp-mega-menu {
      display: flex;
      flex-direction: column;
      min-width: 280px;
      max-width: 80vw;
      max-height: 60vh;
      background: var(--tui-background-base);
      border-radius: 0.75rem;
      overflow: hidden;
      box-shadow: var(--tui-shadow-medium);
    }

    .erp-mega-menu__search {
      padding: 0.75rem;
      border-bottom: 1px solid var(--tui-border-normal);
    }

    .erp-mega-menu__empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
      color: var(--tui-text-tertiary);
    }

    .erp-mega-menu__empty-icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      opacity: 0.5;
    }

    .erp-mega-menu__empty-text {
      font: var(--tui-font-text-s);
      text-align: center;
    }

    .erp-mega-menu__columns {
      display: flex;
      flex-wrap: wrap;
      gap: 0;
      overflow-y: auto;
      padding: 0.5rem 0;
    }

    .erp-mega-menu__column {
      min-width: 200px;
      max-width: 280px;
      flex: 1 1 200px;
      padding: 0 0.5rem;
      border-right: 1px solid var(--tui-border-normal);
    }

    .erp-mega-menu__column:last-child {
      border-right: none;
    }

    .erp-mega-menu__group-header {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 0.75rem 0.25rem;
      font: var(--tui-font-text-s);
      font-weight: 700;
      color: var(--tui-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-size: 0.6875rem;
    }

    .erp-mega-menu__group-icon {
      font-size: 0.875rem;
      color: var(--tui-text-tertiary);
    }

    .erp-mega-menu__group-label {
      flex: 1;
    }

    .erp-mega-menu__dynamic-badge {
      font-size: 0.5625rem;
      padding: 0.0625rem 0.375rem;
      background: var(--tui-status-info-pale);
      color: var(--tui-status-info);
      border-radius: 0.25rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .erp-mega-menu__actions {
      display: flex;
      flex-direction: column;
      padding: 0.25rem 0;
    }

    .erp-mega-menu__action {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.4375rem 0.75rem;
      border: none;
      background: transparent;
      cursor: pointer;
      font: var(--tui-font-text-s);
      color: var(--tui-text-primary);
      border-radius: 0.375rem;
      transition: background-color 0.15s ease;
      text-align: left;
    }

    .erp-mega-menu__action:hover:not(:disabled) {
      background: var(--tui-background-neutral-1-hover);
    }

    .erp-mega-menu__action:active:not(:disabled) {
      background: var(--tui-background-neutral-1-pressed);
    }

    .erp-mega-menu__action--child {
      padding-left: 1.75rem;
      font-size: 0.8125rem;
    }

    .erp-mega-menu__action--disabled {
      opacity: var(--tui-disabled-opacity);
      cursor: not-allowed;
    }

    .erp-mega-menu__action--warning {
      color: var(--tui-text-negative);
    }

    .erp-mega-menu__action--info {
      color: var(--tui-text-action);
    }

    .erp-mega-menu__action--success {
      color: var(--tui-status-positive);
    }

    .erp-mega-menu__action-icon {
      font-size: 1rem;
      flex-shrink: 0;
      color: inherit;
    }

    .erp-mega-menu__action-label {
      flex: 1;
      line-height: 1.25;
      word-break: break-word;
    }

    .erp-mega-menu__action-label--dynamic {
      font-weight: 600;
      color: var(--tui-text-primary);
    }

    .erp-mega-menu__action-loader {
      width: 100%;
    }

    .erp-mega-menu__action-content {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
    }

    .erp-mega-menu__shortcut {
      font-size: 0.6875rem;
      padding: 0.125rem 0.375rem;
      background: var(--tui-background-neutral-1);
      color: var(--tui-text-secondary);
      border-radius: 0.25rem;
      border: 1px solid var(--tui-border-normal);
      font-family: var(--tui-font-text);
      white-space: nowrap;
      flex-shrink: 0;
    }

    .erp-mega-menu__hint-icon {
      font-size: 0.875rem;
      color: var(--tui-text-tertiary);
      cursor: help;
      flex-shrink: 0;
    }

    .erp-mega-menu__separator {
      margin: 0.25rem 0.75rem;
      border: 0;
      border-top: 1px solid var(--tui-border-normal);
      opacity: 0.5;
    }

    .erp-mega-menu__dynamic-item-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0.75rem 0.125rem;
    }

    .erp-mega-menu__children {
      display: flex;
      flex-direction: column;
    }

    .erp-mega-menu__action-parent {
      display: flex;
      flex-direction: column;
    }

    .erp-mega-menu__empty {
      padding: 0.75rem;
      color: var(--tui-text-tertiary);
      font: var(--tui-font-text-s);
      font-style: italic;
    }
  `],
})
export class ErpActionToolbarMegaMenuComponent implements AfterViewInit {
  protected readonly SHARED_KEYS = SHARED_KEYS;
  
  private readonly el = inject(ElementRef<HTMLElement>);

  ngAfterViewInit(): void {
    // Timeout pozwalający na zakończenie animacji wejścia (dropdown/overlay)
    setTimeout(() => {
      const input = this.el.nativeElement.querySelector('input');
      if (input) {
        input.focus();
      }
    }, 50);
  }

  /** Grupy akcji do wyświetlenia. */
  readonly groups = input.required<ErpActionGroup[]>();

  /** Dynamiczne providery. */
  readonly dynamicProviders = input<ErpDynamicActionProvider[]>([]);

  /**
   * Mapa niestandardowych skrótów klawiszowych usera.
   * Klucz = actionId, wartość = shortcut string.
   */
  readonly customShortcuts = input<Record<string, string>>({});

  /** Emitowane po kliknięciu akcji. */
  readonly actionClick = output<ErpActionDef>();

  /** Emitowane po kliknięciu dynamicznej akcji. */
  readonly dynamicActionClick = output<{ template: ErpActionDef; item: ErpDynamicActionItem }>();

  /** Wyszukiwarka. */
  readonly searchTerm = signal('');

  private readonly transloco = inject(TranslocoService);

  protected readonly searchInputConfig = ErpInputBuilder.create(b => b
    .setIconStart('@tui.search')
    .setPlaceholder(SHARED_KEYS.actionToolbar.megaMenu.searchPlaceholder)
  );

  /** Stany ładowania poszczególnych akcji. */
  protected readonly loadingActions = signal<Set<string>>(new Set());

  /** Filtrowane grupy (po search). */
  protected readonly _filteredGroups = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const groups = this.groups();

    if (!term) return groups;

    return groups
      .filter(group => !group.excludeFromSearch)
      .map(group => {
        const filteredActions = group.actions.filter(a => {
          const label = unwrapSignal(a.label);
          const labelStr = typeof label === 'string' ? label : label?.key ?? '';
          const translatedLabel = this.transloco.translate(labelStr).toLowerCase();
          return translatedLabel.includes(term);
        });
        return filteredActions.length > 0 ? { ...group, actions: filteredActions } : null;
      })
      .filter((g): g is ErpActionGroup => g !== null);
  });

  /** Filtrowane dynamiczne providery (po search). */
  protected readonly _filteredDynamicProviders = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const providers = this.dynamicProviders();

    if (!term) return providers;

    return providers.filter(dp => {
      const items = dp.items();
      return items.some(item => {
        const translatedLabel = this.transloco.translate(item.label).toLowerCase();
        return translatedLabel.includes(term);
      });
    });
  });

  /** Czy są jakiekolwiek widoczne grupy/akcje do wyrenderowania */
  protected readonly _hasAnyResults = computed(() => this._filteredGroups().length > 0 || this._filteredDynamicProviders().length > 0);

  protected unwrap<T>(val: MaybeSignal<T> | undefined): T | undefined {
    return unwrapSignal(val);
  }

  protected getEffectiveShortcut(action: ErpActionDef): string | undefined {
    const customs = this.customShortcuts();
    return customs[action.id] ?? action.shortcut;
  }

  protected isActionLoading(action: ErpActionDef): boolean {
    return this.loadingActions().has(action.id);
  }

  protected async onActionClick(action: ErpActionDef): Promise<void> {
    if (unwrapSignal(action.disabled)) return;

    const fn = action.fn;
    if (!fn) {
      this.actionClick.emit(action);
      return;
    }

    const result = fn();
    if (result instanceof Promise) {
      this.loadingActions.update(set => {
        const next = new Set(set);
        next.add(action.id);
        return next;
      });
      try {
        await result;
      } finally {
        this.loadingActions.update(set => {
          const next = new Set(set);
          next.delete(action.id);
          return next;
        });
      }
    }
    this.actionClick.emit(action);
  }

  protected async onDynamicActionClick(template: ErpActionDef, item: ErpDynamicActionItem): Promise<void> {
    if (unwrapSignal(template.disabled)) return;

    const fn = template.dynamicFn;
    if (fn) {
      const result = fn(item);
      if (result instanceof Promise) {
        await result;
      }
    }
    this.dynamicActionClick.emit({ template, item });
  }
}
