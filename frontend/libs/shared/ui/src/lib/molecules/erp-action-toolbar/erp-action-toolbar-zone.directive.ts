import {
  Directive,
  ElementRef,
  inject,
  input,
  signal,
  computed,
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
 * <div erpActionToolbarZone>
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

  /** Stan najechania myszą. */
  private readonly _isHovered = signal(false);
  
  /** Stan otwartego menu kontekstowego. */
  private readonly _isContextMenuOpen = signal(false);

  /** Czy mysz jest w obszarze lub menu kontekstowe jest otwarte. */
  readonly isActive = computed(() => this._isHovered() || this._isContextMenuOpen());

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  ngOnInit(): void {
    this.injectStyles();
  }

  ngOnDestroy(): void {}

  protected onMouseEnter(): void {
    this._isHovered.set(true);
  }

  protected onMouseLeave(): void {
    this._isHovered.set(false);
  }

  /**
   * Zmienia stan otwartego menu kontekstowego.
   * Używane przez ErpActionToolbarContextDirective, aby nie gubić focusu z obszaru.
   */
  public setContextMenuOpen(isOpen: boolean): void {
    this._isContextMenuOpen.set(isOpen);
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
        transition: box-shadow 0.2s ease, outline-color 0.2s ease;
        border-radius: 0.5rem;
        outline: 2px solid transparent;
        outline-offset: 2px;
        box-shadow: 0 0 0 4px transparent;
      }

      .erp-action-toolbar-zone--active {
        outline-color: color-mix(in srgb, var(--tui-text-action) 25%, transparent);
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--tui-text-action) 8%, transparent);
      }
    `;
    document.head.appendChild(style);
  }
}
