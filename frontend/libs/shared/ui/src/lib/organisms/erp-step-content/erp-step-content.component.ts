import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpStepContentConfig, ErpStepContentElement } from './erp-step-content.types';
import { unwrapSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpTextComponent } from '../../atoms/erp-text/erp-text.component';
import { ErpFormComponent } from '../erp-form/erp-form.component';
import { ErpSplitterComponent } from '../../atoms/erp-splitter/erp-splitter.component';
import { ErpCardComponent } from '../../atoms/erp-card/erp-card.component';

/**
 * Generyczny renderer treści stepu modalu.
 *
 * Iteruje po elementach `ErpStepContentConfig` i renderuje odpowiedni
 * komponent per typ elementu. Obsługuje rekurencję — sekcje (`type='section'`)
 * renderują zagnieżdżony `<erp-step-content>`.
 *
 * Używany automatycznie przez `ErpModalBuilder.addContentStep()`.
 * Można też użyć bezpośrednio w dowolnym template.
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
    CommonModule,
    ErpTranslatePipe,
    ErpTextComponent,
    ErpFormComponent,
    ErpSplitterComponent,
    ErpCardComponent,
  ],
  template: `
    @let _elements = config().elements;
    @let _rootClass = rootLayoutClass();

    <div [class]="_rootClass" [ngStyle]="rootStyle()">
      @for (element of _elements; track $index) {
        <div [class]="elementWrapperClass(element)" [ngStyle]="elementWrapperStyle(element)">
          @switch (element.type) {
            @case ('text') {
              <erp-text [config]="element.config" />
            }
            @case ('form') {
              <erp-form [config]="element.config" />
            }
            @case ('splitter') {
              <erp-splitter [config]="element.config" />
            }
            @case ('card') {
              <erp-card [config]="element.config" />
            }
            @case ('component') {
              @let _comp = resolveComponent(element);
              @if (_comp) {
                <ng-container
                  *ngComponentOutlet="_comp; inputs: element.inputs"
                />
              }
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
    const layout = unwrapSignal(this.config().layout) || 'stack';
    const customClass = unwrapSignal(this.config().styleClass) || '';
    return `erp-step-content--${layout}${customClass ? ' ' + customClass : ''}`;
  });

  protected rootStyle = computed<Record<string, string>>(() => {
    const style: Record<string, string> = {};
    const gap = unwrapSignal(this.config().gap);
    const layout = unwrapSignal(this.config().layout) || 'stack';
    const gridCols = unwrapSignal(this.config().gridCols);

    if (gap) {
      style['gap'] = gap;
    } else {
      // Domyślne gapy per layout
      style['gap'] = layout === 'grid' ? '1rem' : '0.75rem';
    }

    if (layout === 'grid' && gridCols) {
      style['grid-template-columns'] = `repeat(${gridCols}, 1fr)`;
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
    const parentLayout = unwrapSignal(this.config().layout) || 'stack';
    if (parentLayout === 'row' && !element.colSpan) {
      parts.push('erp-step-content__element--flex-fill');
    }

    return parts.join(' ');
  }

  /**
   * Generuje inline style wrappera elementu.
   * Obsługuje colSpan dla layout='grid' i niestandardowe style.
   */
  protected elementWrapperStyle(element: ErpStepContentElement): Record<string, string> {
    const result: Record<string, string> = {};

    const colSpan = unwrapSignal(element.colSpan);
    if (colSpan) {
      result['grid-column'] = `span ${colSpan}`;
    }

    const customStyle = unwrapSignal(element.style);
    if (customStyle) {
      Object.assign(result, customStyle);
    }

    return result;
  }

  /**
   * Unwrapuje MaybeSignal<Type<any>> do klasy komponentu.
   * Potrzebne bo ngComponentOutlet nie przyjmuje Signali.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected resolveComponent(element: ErpStepContentElement): any {
    if (!element.component) return null;
    return unwrapSignal(element.component);
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
  protected toSectionConfig(element: ErpStepContentElement): ErpStepContentConfig {
    return {
      elements: element.children || [],
      layout: element.layout,
      gridCols: element.gridCols,
      gap: element.gap,
      styleClass: element.styleClass,
    };
  }
}
