import {
  Directive,
  ElementRef,
  inject,
  input,
  signal,
  OnInit,
  OnDestroy,
  Renderer2,
} from '@angular/core';

/**
 * Dyrektywa wizualnego wskaźnika obszaru skrótów klawiszowych.
 * Po najechaniu kursorem na obszar opatruje go subtelnym obramowaniem/cieniem
 * informującym usera, że w tym kontekście działają skróty klawiszowe.
 *
 * @example
 * ```html
 * <div erpActionToolbarZone [erpActionToolbarZoneLabel]="'Produkty'">
 *   <erp-action-toolbar [config]="toolbarConfig" />
 *   <erp-table [config]="tableConfig" />
 * </div>
 * ```
 */
@Directive({
  selector: '[erpActionToolbarZone]',
  standalone: true,
  host: {
    'class': 'erp-action-toolbar-zone',
    '[class.erp-action-toolbar-zone--active]': 'isActive()',
    '(mouseenter)': 'onMouseEnter()',
    '(mouseleave)': 'onMouseLeave()',
  },
})
export class ErpActionToolbarZoneDirective implements OnInit, OnDestroy {
  /**
   * Opcjonalna etykieta wyświetlana jako badge w rogu obszaru
   * kiedy user najedzie myszką (np. „Produkty ⌨").
   */
  readonly erpActionToolbarZoneLabel = input<string>('');

  /** Czy mysz jest w obszarze. */
  readonly isActive = signal(false);

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  ngOnInit(): void {
    this.injectStyles();
  }

  ngOnDestroy(): void {}

  protected onMouseEnter(): void {
    this.isActive.set(true);
  }

  protected onMouseLeave(): void {
    this.isActive.set(false);
  }

  /**
   * Wstrzyknięcie globalnych styli (wykonywane raz).
   * Używamy tego podejścia zamiast inline styles dla klasy --active.
   */
  private injectStyles(): void {
    const STYLE_ID = 'erp-action-toolbar-zone-styles';
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .erp-action-toolbar-zone {
        position: relative;
        transition: box-shadow 0.2s ease, outline 0.2s ease;
        border-radius: 0.5rem;
      }

      .erp-action-toolbar-zone--active {
        outline: 2px solid color-mix(in srgb, var(--tui-text-action) 25%, transparent);
        outline-offset: 2px;
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--tui-text-action) 8%, transparent);
      }
    `;
    document.head.appendChild(style);
  }
}
