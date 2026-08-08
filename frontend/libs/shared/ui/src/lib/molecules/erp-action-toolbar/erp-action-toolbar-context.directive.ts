import {
  Directive,
  ElementRef,
  inject,
  input,
  computed,
  OnInit,
  OnDestroy,
  Injector,
} from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  ErpActionToolbarConfig,
  ErpToolbarUserPrefs,
  ErpActionGroup,
  ErpActionDef,
  ErpDynamicActionProvider,
} from './erp-action-toolbar.types';
import { ErpPreferencesType, ErpUserPreferencesService } from '@erp/shared/data-access';
import { ErpActionToolbarZoneDirective } from './erp-action-toolbar-zone.directive';
import { ErpActionToolbarContextMenuComponent } from './erp-action-toolbar-context-menu.component';
import { SHARED_KEYS } from '../../translation/keys';

/**
 * Dyrektywa context menu (PPM) — reaguje na `contextmenu` event
 * na host element i wyświetla Mega Menu z akcjami toolbara w CDK Overlay.
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
  private readonly overlay = inject(Overlay);
  private readonly injector = inject(Injector);

  private contextMenuHandler: ((e: MouseEvent) => void) | null = null;
  private overlayRef: OverlayRef | null = null;

  // ─── Preferencje usera ─────────────────────────
  private readonly _userPrefs = computed<ErpToolbarUserPrefs | undefined>(() => {
    const config = this.erpActionToolbarContext();
    return this.preferencesService.getState(ErpPreferencesType.ActionToolbar, config.menuId) as ErpToolbarUserPrefs | undefined;
  });

  // ─── Filtrowanie ─────────────────────────
  private readonly _baseGroups = computed<ErpActionGroup[]>(() => {
    const config = this.erpActionToolbarContext();
    const prefs = this._userPrefs();

    const selectionCount = config.selectionCount?.() ?? 0;
    const groups = selectionCount > 0
      ? (config.selectionGroups ?? [])
      : config.defaultGroups;

    if (!prefs) return groups;

    return groups
      .filter(g => !prefs.hiddenGroupIds?.includes(g.id))
      .map(g => ({
        ...g,
        actions: g.actions.filter(a => !prefs.hiddenActionIds?.includes(a.id)),
      }));
  });

  /** Efektywne ID przypiętych akcji (user prefs > config default). */
  private readonly _effectivePinnedIds = computed<string[]>(() => {
    const prefs = this._userPrefs();
    if (prefs?.pinnedActionIds?.length) {
      return prefs.pinnedActionIds;
    }
    return this.erpActionToolbarContext().pinnedActionIds ?? [];
  });

  /** Grupa "Przypięte" — pierwsza grupa w menu PPM, jeśli są pinned akcje. */
  private readonly _pinnedGroup = computed<ErpActionGroup | null>(() => {
    const pinnedIds = this._effectivePinnedIds();
    if (pinnedIds.length === 0) return null;

    const allActions = this._baseGroups().flatMap(g => g.actions);
    const actions = pinnedIds
      .map(id => allActions.find(a => a.id === id))
      .filter((a): a is ErpActionDef => a !== undefined);

    if (actions.length === 0) return null;

    return {
      id: '__pinned__',
      label: SHARED_KEYS.actionToolbar.megaMenu.pinned,
      icon: '@tui.pin',
      actions,
      excludeFromSearch: true,
    };
  });

  private readonly _groups = computed<ErpActionGroup[]>(() => {
    const pinnedGroup = this._pinnedGroup();
    const base = this._baseGroups();
    return pinnedGroup ? [pinnedGroup, ...base] : base;
  });

  private readonly _dynamicProviders = computed<ErpDynamicActionProvider[]>(() => {
    const config = this.erpActionToolbarContext();
    const providers = config.dynamicProviders ?? [];
    const prefs = this._userPrefs();

    if (!prefs) return providers;

    return providers.filter(dp => {
      const groupPrefs = prefs.dynamicGroupPrefs?.[dp.groupId];
      return !groupPrefs?.hidden;
    });
  });

  private readonly _customShortcuts = computed<Record<string, string>>(() => {
    return this._userPrefs()?.customShortcuts ?? {};
  });

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
    if (event.shiftKey) {
      // Escape hatch: Shift + PPM przepuszcza kliknięcie do przeglądarki
      return;
    }
    
    event.preventDefault();
    event.stopPropagation();
    this.destroyOverlay();
    this.createOverlay(event.clientX, event.clientY);
  }

  private createOverlay(x: number, y: number): void {
    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo({ x, y })
      .withPositions([
        { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'top' },
        { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'top' },
        { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'bottom' },
        { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'bottom' },
      ])
      .withPush(true)
      .withViewportMargin(8);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
      scrollStrategy: this.overlay.scrollStrategies.close(),
    });

    const portal = new ComponentPortal(ErpActionToolbarContextMenuComponent, null, this.injector);
    const componentRef = this.overlayRef.attach(portal);

    // Przekazanie inputów do wrappera
    componentRef.setInput('groups', this._groups());
    componentRef.setInput('dynamicProviders', this._dynamicProviders());
    componentRef.setInput('customShortcuts', this._customShortcuts());

    // Subskrypcje zamykające overlay
    this.overlayRef.backdropClick().subscribe((event: MouseEvent) => {
      this.destroyOverlay();
      
      // Click-through: powtórz klik na elemencie pod kursorem
      const config = this.erpActionToolbarContext();
      if (config.backdropClickThrough !== false) {
        this.replayClickAtPoint(event.clientX, event.clientY);
      }
    });
    
    // Blokowanie systemowego menu pod prawym przyciskiem myszy na tło
    if (this.overlayRef.backdropElement) {
      this.overlayRef.backdropElement.addEventListener('contextmenu', (e: MouseEvent) => {
        const clientX = e.clientX;
        const clientY = e.clientY;
        if (!e.shiftKey) {
          e.preventDefault();
        }
        this.destroyOverlay();
        
        // Click-through dla PPM na backdropsie
        const config = this.erpActionToolbarContext();
        if (config.backdropClickThrough !== false) {
          this.replayContextMenuAtPoint(clientX, clientY);
        }
      });
    }

    componentRef.instance.closed.subscribe(() => this.destroyOverlay());

    this.zone?.setContextMenuOpen(true);
  }

  private destroyOverlay(): void {
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
    }
    this.zone?.setContextMenuOpen(false);
  }

  /**
   * Programowo powtarza kliknięcie (mousedown → mouseup → click)
   * na elemencie znajdującym się pod podanymi współrzędnymi ekranu.
   * Backdrop CDK został już usunięty, więc elementFromPoint zwróci
   * rzeczywisty element (np. komórkę tabeli).
   */
  private replayClickAtPoint(x: number, y: number): void {
    // Używamy setTimeout(0), aby backdrop zdążył zostać usunięty z DOM
    setTimeout(() => {
      const target = document.elementFromPoint(x, y);
      if (!target) return;

      const eventInit: MouseEventInit = {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        view: window,
      };

      target.dispatchEvent(new MouseEvent('mousedown', eventInit));
      target.dispatchEvent(new MouseEvent('mouseup', eventInit));
      target.dispatchEvent(new MouseEvent('click', eventInit));
    }, 0);
  }

  /**
   * Programowo emituje zdarzenie contextmenu na elemencie pod kursorem,
   * aby ponowne PPM na tle otwierało menu na właściwej pozycji.
   */
  private replayContextMenuAtPoint(x: number, y: number): void {
    setTimeout(() => {
      const target = document.elementFromPoint(x, y);
      if (!target) return;

      target.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        view: window,
      }));
    }, 0);
  }
}
