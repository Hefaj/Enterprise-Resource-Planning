import {
  Directive,
  ElementRef,
  inject,
  input,
  computed,
  signal,
  OnInit,
  OnDestroy,
  ViewContainerRef,
  TemplateRef,
  EmbeddedViewRef,
} from '@angular/core';
import { unwrapSignal } from '../../base/erp-signal-utils';
import {
  ErpActionDef,
  ErpActionGroup,
  ErpActionToolbarConfig,
  ErpDynamicActionItem,
  ErpToolbarUserPrefs,
} from './erp-action-toolbar.types';
import { ErpPreferencesType, ErpUserPreferencesService } from '@erp/shared/data-access';
import { ErpActionToolbarZoneDirective } from './erp-action-toolbar-zone.directive';

/**
 * Punkt danych wyświetlany w context menu.
 * Służy jako pośredni model do budowania listy w overlay.
 */
export interface ErpContextMenuItem {
  type: 'action' | 'group-header' | 'separator' | 'dynamic-header';
  action?: ErpActionDef;
  label?: string;
  icon?: string;
  disabled?: boolean;
  dynamicItem?: ErpDynamicActionItem;
  children?: ErpContextMenuItem[];
}

/**
 * Dyrektywa context menu (PPM) — reaguje na `contextmenu` event
 * na host element i wyświetla kaskadowe menu z akcjami toolbara.
 *
 * W context menu NIE wyświetlamy zębatki konfiguracji.
 * Skróty klawiszowe są widoczne obok akcji.
 *
 * @example
 * ```html
 * <div [erpActionToolbarContext]="toolbarConfig">
 *   <erp-table [config]="tableConfig" />
 * </div>
 * ```
 */
@Directive({
  selector: '[erpActionToolbarContext]',
  standalone: true,
})
export class ErpActionToolbarContextDirective implements OnInit, OnDestroy {
  /** Konfiguracja toolbara z którego pobieramy akcje. */
  readonly erpActionToolbarContext = input.required<ErpActionToolbarConfig>();

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly preferencesService = inject(ErpUserPreferencesService);
  private readonly zone = inject(ErpActionToolbarZoneDirective, { optional: true });

  private contextMenuHandler: ((e: MouseEvent) => void) | null = null;
  private overlayElement: HTMLElement | null = null;
  private backdropElement: HTMLElement | null = null;

  ngOnInit(): void {
    this.contextMenuHandler = (e: MouseEvent) => this.onContextMenu(e);
    this.el.nativeElement.addEventListener('contextmenu', this.contextMenuHandler);
  }

  ngOnDestroy(): void {
    if (this.contextMenuHandler) {
      this.el.nativeElement.removeEventListener('contextmenu', this.contextMenuHandler);
    }
    this.destroyOverlay();
  }

  private onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.destroyOverlay();
    this.createOverlay(event.clientX, event.clientY);
  }

  private getMenuItems(): ErpContextMenuItem[] {
    const config = this.erpActionToolbarContext();
    const prefs = this.preferencesService.getState(
      ErpPreferencesType.ActionToolbar,
      config.menuId
    ) as ErpToolbarUserPrefs | undefined;

    const selectionCount = config.selectionCount?.() ?? 0;
    const groups = selectionCount > 0
      ? (config.selectionGroups ?? [])
      : config.defaultGroups;

    const items: ErpContextMenuItem[] = [];

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];

      // Sprawdź ukryte grupy
      if (prefs?.hiddenGroupIds?.includes(group.id)) continue;

      if (gi > 0) {
        items.push({ type: 'separator' });
      }

      items.push({
        type: 'group-header',
        label: typeof unwrapSignal(group.label) === 'string'
          ? unwrapSignal(group.label) as string
          : '',
        icon: unwrapSignal(group.icon) as string | undefined,
      });

      for (const action of group.actions) {
        if (prefs?.hiddenActionIds?.includes(action.id)) continue;
        if (unwrapSignal(action.hidden)) continue;

        const children = action.children?.filter(c => !unwrapSignal(c.hidden))
          .map(c => this.actionToMenuItem(c, prefs));

        items.push({
          type: 'action',
          action,
          label: this.resolveLabel(action),
          icon: unwrapSignal(action.icon) as string | undefined,
          disabled: unwrapSignal(action.disabled) ?? false,
          children: children?.length ? children : undefined,
        });
      }
    }

    // Dynamiczne providery
    const dynamicProviders = config.dynamicProviders ?? [];
    for (const dp of dynamicProviders) {
      const groupPrefs = prefs?.dynamicGroupPrefs?.[dp.groupId];
      if (groupPrefs?.hidden) continue;

      if (items.length > 0) {
        items.push({ type: 'separator' });
      }

      items.push({
        type: 'group-header',
        label: typeof unwrapSignal(dp.label) === 'string'
          ? unwrapSignal(dp.label) as string
          : '',
        icon: unwrapSignal(dp.icon) as string | undefined,
      });

      const dynamicItems = dp.items();
      for (const dynItem of dynamicItems) {
        const templateChildren = dp.actionTemplate
          .filter(t => !groupPrefs?.hiddenSubActionIds?.includes(t.id))
          .map(t => ({
            type: 'action' as const,
            action: t,
            label: this.resolveLabel(t),
            icon: unwrapSignal(t.icon) as string | undefined,
            disabled: unwrapSignal(t.disabled) ?? false,
            dynamicItem: dynItem,
          }));

        items.push({
          type: 'dynamic-header',
          label: dynItem.label,
          icon: dynItem.icon,
          children: templateChildren,
        });
      }
    }

    return items;
  }

  private actionToMenuItem(action: ErpActionDef, prefs?: ErpToolbarUserPrefs): ErpContextMenuItem {
    return {
      type: 'action',
      action,
      label: this.resolveLabel(action),
      icon: unwrapSignal(action.icon) as string | undefined,
      disabled: unwrapSignal(action.disabled) ?? false,
    };
  }

  private resolveLabel(action: ErpActionDef): string {
    const raw = unwrapSignal(action.label);
    if (typeof raw === 'string') return raw;
    return raw?.key ?? '';
  }

  // ─── Overlay rendering (proste DOM-based) ─────────

  private createOverlay(x: number, y: number): void {
    // Backdrop
    this.backdropElement = document.createElement('div');
    Object.assign(this.backdropElement.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '9998',
      background: 'transparent',
    });
    this.backdropElement.addEventListener('click', () => this.destroyOverlay());
    this.backdropElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.destroyOverlay();
    });
    document.body.appendChild(this.backdropElement);

    // Menu
    const items = this.getMenuItems();
    this.overlayElement = this.buildMenuElement(items);
    Object.assign(this.overlayElement.style, {
      position: 'fixed',
      zIndex: '9999',
    });
    document.body.appendChild(this.overlayElement);

    // Pozycjonowanie (z uwzględnieniem krawędzi ekranu)
    requestAnimationFrame(() => {
      if (!this.overlayElement) return;
      const rect = this.overlayElement.getBoundingClientRect();
      const adjustedX = x + rect.width > window.innerWidth ? window.innerWidth - rect.width - 8 : x;
      const adjustedY = y + rect.height > window.innerHeight ? window.innerHeight - rect.height - 8 : y;
      this.overlayElement.style.left = `${Math.max(4, adjustedX)}px`;
      this.overlayElement.style.top = `${Math.max(4, adjustedY)}px`;
    });
    
    this.zone?.setContextMenuOpen(true);
  }

  private buildMenuElement(items: ErpContextMenuItem[]): HTMLElement {
    const menu = document.createElement('div');
    menu.className = 'erp-ctx-menu';
    Object.assign(menu.style, {
      background: 'var(--tui-background-base)',
      border: '1px solid var(--tui-border-normal)',
      borderRadius: '0.5rem',
      boxShadow: '0 8px 24px rgba(0,0,0,.15)',
      minWidth: '200px',
      maxWidth: '320px',
      padding: '0.25rem 0',
      overflow: 'hidden',
      fontFamily: 'var(--tui-font-text)',
      fontSize: '0.8125rem',
    });

    for (const item of items) {
      if (item.type === 'separator') {
        const sep = document.createElement('hr');
        Object.assign(sep.style, {
          margin: '0.25rem 0',
          border: '0',
          borderTop: '1px solid var(--tui-border-normal)',
          opacity: '0.5',
        });
        menu.appendChild(sep);
      } else if (item.type === 'group-header' || item.type === 'dynamic-header') {
        const header = document.createElement('div');
        Object.assign(header.style, {
          padding: '0.375rem 0.75rem 0.125rem',
          fontSize: '0.625rem',
          fontWeight: '700',
          color: 'var(--tui-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          userSelect: 'none',
        });
        header.textContent = item.label ?? '';

        if (item.type === 'dynamic-header' && item.children?.length) {
          menu.appendChild(header);
          for (const child of item.children) {
            menu.appendChild(this.buildActionButton(child));
          }
        } else {
          menu.appendChild(header);
        }
      } else if (item.type === 'action') {
        menu.appendChild(this.buildActionButton(item));
      }
    }

    return menu;
  }

  private buildActionButton(item: ErpContextMenuItem): HTMLElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    Object.assign(btn.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      width: '100%',
      padding: '0.4375rem 0.75rem',
      border: 'none',
      background: 'transparent',
      cursor: item.disabled ? 'not-allowed' : 'pointer',
      color: this.getItemColor(item),
      opacity: item.disabled ? '0.4' : '1',
      textAlign: 'left',
      fontSize: '0.8125rem',
      fontFamily: 'inherit',
      borderRadius: '0',
      transition: 'background-color 0.12s ease',
    });

    btn.addEventListener('mouseenter', () => {
      if (!item.disabled) btn.style.background = 'var(--tui-background-neutral-1-hover)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
    });

    if (item.label) {
      const labelSpan = document.createElement('span');
      labelSpan.style.flex = '1';
      labelSpan.textContent = item.label;
      btn.appendChild(labelSpan);
    }

    // Skrót klawiszowy
    const config = this.erpActionToolbarContext();
    const prefs = this.preferencesService.getState(
      ErpPreferencesType.ActionToolbar,
      config.menuId
    ) as ErpToolbarUserPrefs | undefined;

    if (item.action) {
      const shortcut = prefs?.customShortcuts?.[item.action.id] ?? item.action.shortcut;
      if (shortcut) {
        const kbd = document.createElement('kbd');
        Object.assign(kbd.style, {
          fontSize: '0.625rem',
          padding: '0.0625rem 0.3rem',
          background: 'var(--tui-background-neutral-1)',
          color: 'var(--tui-text-secondary)',
          borderRadius: '0.1875rem',
          border: '1px solid var(--tui-border-normal)',
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
        });
        kbd.textContent = shortcut;
        btn.appendChild(kbd);
      }
    }

    // Click handler
    if (!item.disabled && item.action) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.dynamicItem && item.action?.dynamicFn) {
          item.action.dynamicFn(item.dynamicItem);
        } else if (item.action?.fn) {
          item.action.fn();
        }
        this.destroyOverlay();
      });
    }

    return btn;
  }

  private getItemColor(item: ErpContextMenuItem): string {
    if (!item.action) return 'var(--tui-text-primary)';
    const appearance = unwrapSignal(item.action.appearance);
    switch (appearance) {
      case 'warning': return 'var(--tui-text-negative)';
      case 'info': return 'var(--tui-text-action)';
      case 'success': return 'var(--tui-status-positive)';
      default: return 'var(--tui-text-primary)';
    }
  }

  private destroyOverlay(): void {
    if (this.overlayElement) {
      this.overlayElement.remove();
      this.overlayElement = null;
    }
    if (this.backdropElement) {
      this.backdropElement.remove();
      this.backdropElement = null;
    }
    this.zone?.setContextMenuOpen(false);
  }
}
