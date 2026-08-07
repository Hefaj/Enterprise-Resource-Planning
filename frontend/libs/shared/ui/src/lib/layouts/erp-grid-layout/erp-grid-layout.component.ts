import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  input,
  signal,
  untracked,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiLoader } from '@taiga-ui/core';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpGridLayoutConfig } from './erp-grid-layout.types';
import { ErpUserPreferencesService, ErpPreferencesType } from '@erp/shared/data-access';

@Component({
  selector: 'erp-grid-layout',
  standalone: true,
  imports: [CommonModule, TuiLoader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="erp-grid-layout"
      [class.erp-grid-layout--dragging]="!!_dragState()"
      [style.grid-template-areas]="_computedAreas()"
      [style.grid-template-columns]="_computedColumns()"
      [style.grid-template-rows]="_computedRows()"
      [style.gap]="_gap()"
    >
      @for (slot of _visibleSlots(); track slot.areaName) {
        <div
          class="erp-grid-layout__area"
          [style.grid-area]="slot.areaName"
          [class]="slot.options?.cssClass ?? ''"
          [class.erp-grid-layout__area--border-left]="config().showBorders || slot.options?.border === 'left' || slot.options?.border === 'all'"
          [class.erp-grid-layout__area--border-right]="config().showBorders || slot.options?.border === 'right' || slot.options?.border === 'all'"
          [class.erp-grid-layout__area--border-top]="config().showBorders || slot.options?.border === 'top' || slot.options?.border === 'all'"
          [class.erp-grid-layout__area--border-bottom]="config().showBorders || slot.options?.border === 'bottom' || slot.options?.border === 'all'"
        >
          <!-- Resizer handle -->
          @if (slot.options?.resizable) {
            <div
              class="erp-grid-layout__resizer"
              [class.erp-grid-layout__resizer--left]="slot.options.resizable === 'left'"
              [class.erp-grid-layout__resizer--right]="slot.options.resizable === 'right'"
              [class.erp-grid-layout__resizer--top]="slot.options.resizable === 'top'"
              [class.erp-grid-layout__resizer--bottom]="slot.options.resizable === 'bottom'"
              (mousedown)="startDrag($event, slot.areaName)"
            ></div>
          }
          
          <!-- Dynamic component -->
          <div class="erp-grid-layout__area-content">
            @defer (on timer(30ms)) {
              <ng-container *ngComponentOutlet="slot.component; inputs: slot.inputs" />
            } @placeholder {
              <div class="erp-defer-loader-container">
                <tui-loader size="l" />
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    .erp-grid-layout {
      display: grid;
      width: 100%;
      height: 100%;
      overflow: hidden;
      /* Smooth transition dla grid-template-columns/rows przy collapse/resize */
      transition: grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                  grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .erp-grid-layout--dragging {
      user-select: none;
      transition: none; /* Wyłącz transition podczas drag */
    }

    .erp-grid-layout__area {
      position: relative;
      overflow: hidden;
      min-width: 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
      background: var(--tui-background-elevation-1);
    }

    .erp-grid-layout__area--border-left { border-left: 1px solid var(--tui-border-normal); }
    .erp-grid-layout__area--border-right { border-right: 1px solid var(--tui-border-normal); }
    .erp-grid-layout__area--border-top { border-top: 1px solid var(--tui-border-normal); }
    .erp-grid-layout__area--border-bottom { border-bottom: 1px solid var(--tui-border-normal); }

    .erp-grid-layout__area-content {
      width: 100%;
      height: 100%;
      overflow: auto;
      flex: 1;
    }

    .erp-defer-loader-container {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      width: 100%;
    }

    /* Resizer handles */
    .erp-grid-layout__resizer {
      position: absolute;
      z-index: 110;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: transparent;
    }

    /* Pełna linia podświetlająca na hover */
    .erp-grid-layout__resizer::before {
      content: '';
      position: absolute;
      background-color: var(--tui-background-accent-1, var(--tui-text-action, #0055ff));
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .erp-grid-layout__resizer:hover::before,
    .erp-grid-layout--dragging .erp-grid-layout__resizer::before {
      opacity: 1;
    }
    
    .erp-grid-layout__resizer::after {
      content: '';
      display: block;
      background-color: var(--tui-border-hover, #999);
      opacity: 0.6;
      transition: background-color 0.2s ease, opacity 0.2s ease;
    }
    
    .erp-grid-layout__resizer:hover::after,
    .erp-grid-layout--dragging .erp-grid-layout__resizer::after {
      background-color: var(--tui-background-accent-1, var(--tui-text-action, #0055ff));
      opacity: 1;
    }

    /* Vertical resizers (left/right) */
    .erp-grid-layout__resizer--left,
    .erp-grid-layout__resizer--right {
      top: 0;
      bottom: 0;
      width: 10px;
      cursor: col-resize;
    }
    .erp-grid-layout__resizer--left::before,
    .erp-grid-layout__resizer--right::before {
      top: 0;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 2px;
    }
    .erp-grid-layout__resizer--left::after,
    .erp-grid-layout__resizer--right::after {
      width: 4px;
      height: 24px;
      border-radius: 4px;
    }
    .erp-grid-layout__resizer--left { left: 0; }
    .erp-grid-layout__resizer--right { right: 0; }

    /* Horizontal resizers (top/bottom) */
    .erp-grid-layout__resizer--top,
    .erp-grid-layout__resizer--bottom {
      left: 0;
      right: 0;
      height: 10px;
      cursor: row-resize;
    }
    .erp-grid-layout__resizer--top::before,
    .erp-grid-layout__resizer--bottom::before {
      left: 0;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      height: 2px;
    }
    .erp-grid-layout__resizer--top::after,
    .erp-grid-layout__resizer--bottom::after {
      height: 4px;
      width: 24px;
      border-radius: 4px;
    }
    .erp-grid-layout__resizer--top { top: 0; }
    .erp-grid-layout__resizer--bottom { bottom: 0; }
  `],
})
export class ErpGridLayoutComponent {
  public readonly config = input.required<ErpGridLayoutConfig>();

  private readonly prefsService = inject(ErpUserPreferencesService);
  private readonly el = inject(ElementRef<HTMLElement>);
  
  private _saveTimeout: any;

  protected readonly _gap = computed(() => this.config().grid.gap ?? '0');

  // Stan szerokości/wysokości po resizie: index kolumny/rzędu -> size w px
  protected readonly _resizedColumnSizes = signal(new Map<number, number>());
  protected readonly _resizedRowSizes = signal(new Map<number, number>());

  // Stan drag
  protected readonly _dragState = signal<{
    areaName: string;
    type: 'left' | 'right' | 'top' | 'bottom';
    startX: number;
    startY: number;
    startSize: number;
    colIdx?: number;
    rowIdx?: number;
  } | null>(null);

  /** Widoczne (nie-collapsed) sloty do wyrenderowania w DOM */
  protected readonly _visibleSlots = computed(() => {
    const areas = this.config().areas;
    const visible = [];
    for (const [name, slot] of areas.entries()) {
      const collapsed = slot.options?.collapsed !== undefined ? unwrapSignal(slot.options.collapsed) : false;
      if (!collapsed) {
        visible.push(slot);
      }
    }
    return visible;
  });

  /** Parsowanie area map: areaName -> { startCol, endCol, startRow, endRow } */
  private readonly _areaMap = computed(() => {
    const grid = this.config().grid;
    const rows = grid.areas.map((r) => r.trim().split(/\s+/));
    const map = new Map<string, { startCol: number; endCol: number; startRow: number; endRow: number }>();

    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx];
      for (let cIdx = 0; cIdx < row.length; cIdx++) {
        const name = row[cIdx];
        if (name === '.') continue;
        
        const existing = map.get(name);
        if (!existing) {
          map.set(name, { startCol: cIdx, endCol: cIdx, startRow: rIdx, endRow: rIdx });
        } else {
          existing.startCol = Math.min(existing.startCol, cIdx);
          existing.endCol = Math.max(existing.endCol, cIdx);
          existing.startRow = Math.min(existing.startRow, rIdx);
          existing.endRow = Math.max(existing.endRow, rIdx);
        }
      }
    }
    return map;
  });

  /** Oblicza zestaw collapsed areas do podmiany w grid-template-areas */
  private readonly _collapsedAreas = computed(() => {
    const set = new Set<string>();
    for (const [name, slot] of this.config().areas.entries()) {
      if (slot.options?.collapsed !== undefined && unwrapSignal(slot.options.collapsed)) {
        set.add(name);
      }
    }
    return set;
  });

  /** Dynamiczne budowanie grid-template-areas */
  protected readonly _computedAreas = computed(() => {
    const grid = this.config().grid;
    const collapsed = this._collapsedAreas();
    
    if (collapsed.size === 0) {
      return grid.areas.map((r) => `'${r}'`).join(' ');
    }
    
    const rows = grid.areas.map((r) => r.trim().split(/\s+/));
    const rebuilt = rows.map((row) => {
      const newRow = [...row];
      for (let i = 0; i < newRow.length; i++) {
        if (collapsed.has(newRow[i])) {
          // Zastąp kropką
          newRow[i] = '.';
        }
      }
      return `'${newRow.join(' ')}'`;
    });
    
    return rebuilt.join(' ');
  });

  /** Dynamiczne budowanie grid-template-columns */
  protected readonly _computedColumns = computed(() => {
    const grid = this.config().grid;
    const baseCols = grid.columns.trim().split(/\s+/);
    const result = [...baseCols];
    const collapsed = this._collapsedAreas();
    const areaMap = this._areaMap();
    
    // Nadpisz wyciągniętymi/zmienionymi wartościami
    for (const [colIdx, size] of this._resizedColumnSizes().entries()) {
      if (colIdx < result.length) {
        result[colIdx] = `${size}px`;
      }
    }
    
    // Wyzeruj kolumny dla collapsed areas
    for (const name of collapsed) {
      const pos = areaMap.get(name);
      if (pos) {
        // Jeśli element zajmuje całą kolumnę(y), zerujemy je
        // Uwaga: w prostej implementacji po prostu zerujemy startCol
        // Dla bardziej skomplikowanych siatek to miejsce wymagałoby głębszej analizy
        for (let i = pos.startCol; i <= pos.endCol; i++) {
          // Upewnijmy się, że żaden inny NIE-collapsed element nie używa tej kolumny
          if (this._isColumnUsedOnlyByCollapsed(i, collapsed, areaMap)) {
            result[i] = '0px';
          }
        }
      }
    }
    
    return result.join(' ');
  });

  /** Dynamiczne budowanie grid-template-rows */
  protected readonly _computedRows = computed(() => {
    const grid = this.config().grid;
    const baseRows = grid.rows.trim().split(/\s+/);
    const result = [...baseRows];
    const collapsed = this._collapsedAreas();
    const areaMap = this._areaMap();
    
    for (const [rowIdx, size] of this._resizedRowSizes().entries()) {
      if (rowIdx < result.length) {
        result[rowIdx] = `${size}px`;
      }
    }
    
    for (const name of collapsed) {
      const pos = areaMap.get(name);
      if (pos) {
        for (let i = pos.startRow; i <= pos.endRow; i++) {
          if (this._isRowUsedOnlyByCollapsed(i, collapsed, areaMap)) {
            result[i] = '0px';
          }
        }
      }
    }
    
    return result.join(' ');
  });

  constructor() {
    // Wczytaj preferencje po załadowaniu
    effect(() => {
      const layoutId = this.config().layoutId;
      if (layoutId) {
        untracked(() => {
          // Używamy ts-ignore bo GridLayout może nie być jeszcze zdefiniowany w enumnie w innym PR,
          // ale chcemy mieć gotowy kod pod nowy enum. Alternatywa: as any
          const saved = this.prefsService.getState(ErpPreferencesType.GridLayout as any, layoutId);
          if (saved) {
            if (saved.columnSizes) {
              const map = new Map<number, number>();
              for (const key of Object.keys(saved.columnSizes)) {
                map.set(Number(key), saved.columnSizes[key]);
              }
              this._resizedColumnSizes.set(map);
            }
            if (saved.rowSizes) {
              const map = new Map<number, number>();
              for (const key of Object.keys(saved.rowSizes)) {
                map.set(Number(key), saved.rowSizes[key]);
              }
              this._resizedRowSizes.set(map);
            }
          }
        });
      }
    });
  }

  private _isColumnUsedOnlyByCollapsed(colIdx: number, collapsed: Set<string>, areaMap: Map<string, { startCol: number, endCol: number }>): boolean {
    let hasSingleColArea = false;
    let hasVisibleSingleColArea = false;

    for (const [name, pos] of areaMap.entries()) {
      if (colIdx >= pos.startCol && colIdx <= pos.endCol) {
        if (pos.startCol === pos.endCol) {
          hasSingleColArea = true;
          if (!collapsed.has(name)) {
            hasVisibleSingleColArea = true;
          }
        }
      }
    }

    // Zwijamy kolumnę tylko wtedy, gdy ma ona przynajmniej jeden obszar jedno-kolumnowy,
    // i WSZYSTKIE takie obszary są zwinięte. Dzięki temu obszary wielokolumnowe (np. tabs)
    // mogą się swobodnie kurczyć, nie blokując zwijania pod spodem.
    if (hasSingleColArea && !hasVisibleSingleColArea) {
      return true;
    }

    return false;
  }

  private _isRowUsedOnlyByCollapsed(rowIdx: number, collapsed: Set<string>, areaMap: Map<string, { startRow: number, endRow: number }>): boolean {
    let hasSingleRowArea = false;
    let hasVisibleSingleRowArea = false;

    for (const [name, pos] of areaMap.entries()) {
      if (rowIdx >= pos.startRow && rowIdx <= pos.endRow) {
        if (pos.startRow === pos.endRow) {
          hasSingleRowArea = true;
          if (!collapsed.has(name)) {
            hasVisibleSingleRowArea = true;
          }
        }
      }
    }

    if (hasSingleRowArea && !hasVisibleSingleRowArea) {
      return true;
    }

    return false;
  }

  protected startDrag(event: MouseEvent, areaName: string): void {
    event.preventDefault();
    
    const slot = this.config().areas.get(areaName);
    if (!slot || !slot.options?.resizable) return;
    
    const resizable = slot.options.resizable;
    const pos = this._areaMap().get(areaName);
    if (!pos) return;

    let targetIdx: number | undefined;
    let startSize = 0;

    // Pobierz aktualny computed style
    const gridEl = this.el.nativeElement.querySelector('.erp-grid-layout') as HTMLElement;
    if (!gridEl) return;
    const compStyle = window.getComputedStyle(gridEl);
    
    if (resizable === 'left' || resizable === 'right') {
      const cols = compStyle.getPropertyValue('grid-template-columns').split('px').map(s => parseFloat(s.trim()));
      targetIdx = resizable === 'left' ? pos.startCol : pos.endCol;
      startSize = cols[targetIdx] || 0;
    } else {
      const rows = compStyle.getPropertyValue('grid-template-rows').split('px').map(s => parseFloat(s.trim()));
      targetIdx = resizable === 'top' ? pos.startRow : pos.endRow;
      startSize = rows[targetIdx] || 0;
    }

    this._dragState.set({
      areaName,
      type: resizable,
      startX: event.clientX,
      startY: event.clientY,
      startSize,
      colIdx: (resizable === 'left' || resizable === 'right') ? targetIdx : undefined,
      rowIdx: (resizable === 'top' || resizable === 'bottom') ? targetIdx : undefined,
    });
  }

  @HostListener('document:mousemove', ['$event'])
  protected onMouseMove(event: MouseEvent): void {
    const drag = this._dragState();
    if (!drag) return;

    const slot = this.config().areas.get(drag.areaName);
    if (!slot) return;

    const minW = unwrapSignal(slot.options?.minWidth) ?? 100;
    const maxW = unwrapSignal(slot.options?.maxWidth) ?? 800;
    const minH = unwrapSignal(slot.options?.minHeight) ?? 100;
    const maxH = unwrapSignal(slot.options?.maxHeight) ?? 800;

    if (drag.type === 'left' || drag.type === 'right') {
      if (drag.colIdx !== undefined) {
        // drag left increases width of the element on the left (so negative delta if we resize right border of a left element)
        // Wait, if resizer is 'right', moving right increases width.
        // If resizer is 'left', moving left increases width.
        const delta = drag.type === 'left' ? drag.startX - event.clientX : event.clientX - drag.startX;
        const newSize = Math.max(minW, Math.min(maxW, drag.startSize + delta));
        
        this._resizedColumnSizes.update(map => {
          const newMap = new Map(map);
          newMap.set(drag.colIdx!, newSize);
          return newMap;
        });
      }
    } else {
      if (drag.rowIdx !== undefined) {
        const delta = drag.type === 'top' ? drag.startY - event.clientY : event.clientY - drag.startY;
        const newSize = Math.max(minH, Math.min(maxH, drag.startSize + delta));
        
        this._resizedRowSizes.update(map => {
          const newMap = new Map(map);
          newMap.set(drag.rowIdx!, newSize);
          return newMap;
        });
      }
    }
  }

  @HostListener('document:mouseup')
  protected onMouseUp(): void {
    const drag = this._dragState();
    if (drag) {
      this._dragState.set(null);
      this.saveLayoutState();
    }
  }

  private saveLayoutState(): void {
    const layoutId = this.config().layoutId;
    if (!layoutId) return;

    clearTimeout(this._saveTimeout);
    this._saveTimeout = setTimeout(() => {
      this.prefsService.saveState(ErpPreferencesType.GridLayout as any, layoutId, {
        columnSizes: Object.fromEntries(this._resizedColumnSizes()),
        rowSizes: Object.fromEntries(this._resizedRowSizes()),
      });
    }, 400);
  }
}
