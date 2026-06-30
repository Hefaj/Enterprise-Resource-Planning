import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { NgComponentOutlet, NgStyle } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import {
  ErpStepContentConfig,
  ErpStepContentElement,
  ErpStepContentSectionElement,
} from './erp-step-content.types';
import { unwrapSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';



/**
 * Generyczny renderer treści stepu modalu.
 *
 * Iteruje po elementach `ErpStepContentConfig` i renderuje odpowiedni
 * komponent per typ elementu. Wszystkie elementy typu `component` są
 * renderowane wyłącznie przez `ngComponentOutlet` — komponent nie importuje
 * żadnych konkretnych atomów/organizmów UI.
 *
 * Sekcje (`type='section'`) renderują zagnieżdżony `<erp-step-content>`.
 * Separatory (`type='divider'`) renderują `<hr>`.
 *
 * ## 3-poziomowy system layout
 *
 * 1. **Predefiniowane** — `stack` (flex-column), `row` (flex-row), `grid` (CSS grid + gridCols)
 * 2. **Grid Areas** — `gridAreas.template` generuje `grid-template-areas`, elementy z `slot` trafiają do slotów
 * 3. **Escape hatch** — `rootStyle` pozwala przekazać surowe CSS properties na root kontener
 *
 * Używany automatycznie przez `ErpModalBuilder.addContentStep()`.
 * Mona też użyć bezpośrednio w dowolnym template.
 *
 * @example
 * ```html
 * <erp-step-content [contentConfig]="config" />
 * ```
 */
@Component({
  selector: 'erp-step-content',
  standalone: true,
  imports: [
    NgComponentOutlet,
    NgStyle,
    ErpTranslatePipe,
    ReactiveFormsModule,
  ],
  template: `
    @let _elements = config().elements;
    @let _rootClass = rootLayoutClass();

    <div [class]="_rootClass" [ngStyle]="rootStyle()">
      @for (element of _elements; track $index) {
        <div [class]="elementWrapperClass(element)" [ngStyle]="elementWrapperStyle(element)">
          @switch (element.type) {
            @case ('component') {
              <ng-container
                *ngComponentOutlet="element.component; inputs: element.inputs"
              />
            }
            @case ('section') {
              @let _sectionTitle = resolveTranslatable(element.title);
              @if (_sectionTitle) {
                <h3 class="erp-step-content__section-title">
                  {{ _sectionTitle | erpTranslate }}
                </h3>
              }
              <erp-step-content [contentConfig]="toSectionConfig(element)" />
            }
            @case ('divider') {
              <hr class="erp-step-content__divider" />
            }
            @case ('formField') {
              @let _ctrl = getControl(element.key);
              @if (_ctrl) {
                <ng-container *ngComponentOutlet="element.component; inputs: { config: element.config, control: _ctrl }" />
              }
            }
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: contents;
    }

    /* ── Root layout variants ── */
    .erp-step-content--stack {
      display: flex;
      flex-direction: column;
    }

    .erp-step-content--row {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
    }

    .erp-step-content--grid {
      display: grid;
    }

    /* ── Section title ── */
    .erp-step-content__section-title {
      margin: 0 0 0.75rem 0;
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--p-surface-700);
      line-height: 1.4;
    }

    :host-context(.dark) .erp-step-content__section-title,
    :host-context([data-theme="dark"]) .erp-step-content__section-title {
      color: var(--p-surface-300);
    }

    /* ── Divider ── */
    .erp-step-content__divider {
      border: none;
      border-top: 1px solid var(--p-surface-200);
      margin: 0.5rem 0;
    }

    :host-context(.dark) .erp-step-content__divider,
    :host-context([data-theme="dark"]) .erp-step-content__divider {
      border-top-color: var(--p-surface-700);
    }

    /* ── Element wrapper (row child fills) ── */
    .erp-step-content__element--flex-fill {
      flex: 1 1 0;
      min-width: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpStepContentComponent {
  /** Konfiguracja treści stepu — wynik z ErpStepContentBuilder. */
  public contentConfig = input.required<ErpStepContentConfig>();

  /**
   * Alias dla contentConfig — pozwala na użycie skróconego inputu.
   * @internal Używany przez ErpModalBuilder.addContentStep().
   */
  protected config = computed(() => this.contentConfig());

  // ── Computed properties ──

  protected rootLayoutClass = computed(() => {
    const cfg = this.config();
    const gridAreas = cfg.gridAreas;
    const layout = gridAreas ? 'grid' : (unwrapSignal(cfg.layout) || 'stack');
    const customClass = unwrapSignal(cfg.styleClass) || '';
    return `erp-step-content--${layout}${customClass ? ' ' + customClass : ''}`;
  });

  protected rootStyle = computed<Record<string, string>>(() => {
    const style: Record<string, string> = {};
    const cfg = this.config();
    const gridAreas = cfg.gridAreas;

    if (gridAreas) {
      // ── Poziom 2: Grid Areas mode ──
      style['grid-template-areas'] = gridAreas.template
        .map(row => `"${row}"`).join(' ');

      const cols = unwrapSignal(gridAreas.columns);
      if (cols) {
        style['grid-template-columns'] = cols;
      }

      const rows = unwrapSignal(gridAreas.rows);
      if (rows) {
        style['grid-template-rows'] = rows;
      }

      const areaGap = unwrapSignal(gridAreas.gap);
      style['gap'] = areaGap || '1rem';
    } else {
      // ── Poziom 1: Predefiniowane layouty ──
      const gap = unwrapSignal(cfg.gap);
      const layout = unwrapSignal(cfg.layout) || 'stack';
      const gridCols = unwrapSignal(cfg.gridCols);

      if (gap) {
        style['gap'] = gap;
      } else {
        // Domyślne gapy per layout
        style['gap'] = layout === 'grid' ? '1rem' : '0.75rem';
      }

      if (layout === 'grid' && gridCols) {
        style['grid-template-columns'] = `repeat(${gridCols}, 1fr)`;
      }
    }

    // ── Poziom 3: Escape hatch — merge custom root style na końcu ──
    const customRootStyle = unwrapSignal(cfg.rootStyle);
    if (customRootStyle) {
      Object.assign(style, customRootStyle);
    }

    return style;
  });

  // ── Helper methods ──

  /**
   * Generuje klasę CSS wrappera elementu.
   * W layoucie `row` dodaje `flex: 1` chyba że element ma colSpan.
   */
  protected elementWrapperClass(element: ErpStepContentElement): string {
    const parts: string[] = [];
    const customClass = unwrapSignal(element.styleClass);
    if (customClass) {
      parts.push(customClass);
    }

    // W layoucie 'row' — dodaj flex-fill domyślnie
    const cfg = this.config();
    const parentLayout = cfg.gridAreas ? 'grid' : (unwrapSignal(cfg.layout) || 'stack');
    if (parentLayout === 'row' && element.type !== 'divider' && !('colSpan' in element && element.colSpan)) {
      parts.push('erp-step-content__element--flex-fill');
    }

    return parts.join(' ');
  }

  /**
   * Generuje inline style wrappera elementu.
   * Obsługuje colSpan dla layout='grid', slot dla gridAreas, i niestandardowe style.
   */
  protected elementWrapperStyle(element: ErpStepContentElement): Record<string, string> {
    const result: Record<string, string> = {};

    // ── Slot → grid-area (Poziom 2: Grid Areas) ──
    if ('slot' in element && element.slot) {
      result['grid-area'] = element.slot;
    }

    // ── colSpan → grid-column (Poziom 1: simple grid) ──
    if ('colSpan' in element) {
      const colSpan = unwrapSignal(element.colSpan);
      if (colSpan) {
        result['grid-column'] = `span ${colSpan}`;
      }
    }

    // ── Custom inline style ──
    const customStyle = unwrapSignal(element.style);
    if (customStyle) {
      Object.assign(result, customStyle);
    }

    return result;
  }

  /** Unwrapuje MaybeSignal<Translatable> do wartości. */
  protected resolveTranslatable(value: unknown): Translatable | null {
    if (!value) return null;
    return unwrapSignal(value as Translatable) || null;
  }

  /**
   * Konwertuje element typu 'section' na pełną konfigurację ErpStepContentConfig
   * do rekurencyjnego renderowania przez zagnieżdżony <erp-step-content>.
   */
  protected toSectionConfig(element: ErpStepContentSectionElement): ErpStepContentConfig {
    return {
      elements: element.children || [],
      layout: element.layout,
      gridAreas: element.gridAreas,
      gridCols: element.gridCols,
      gap: element.gap,
      styleClass: element.styleClass,
      formGroup: this.config().formGroup,
    };
  }

  protected getControl(key: string): import('@angular/forms').FormControl | null {
    return (this.config().formGroup?.get(key) as import('@angular/forms').FormControl) || null;
  }
}

