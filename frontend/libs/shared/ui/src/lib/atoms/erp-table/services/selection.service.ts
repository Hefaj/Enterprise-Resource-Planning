import { Injectable, signal } from '@angular/core';
import { SelectionState, SelectionType } from '../models/selection.models';

@Injectable()
export class SelectionService {
  private _state = signal<SelectionState>({
    type: null,
    rowIds: new Set<string>(),
    cells: new Set<string>(),
  });

  public readonly selection = this._state.asReadonly();

  public select(rowId: string, type: SelectionType, field?: string, isMulti = false, isRange = false): void {
    this._state.update((curr) => {
      // Create new sets to ensure reactivity
      let nextRowIds = (curr.type !== type || (!isMulti && !isRange)) ? new Set<string>() : new Set<string>(curr.rowIds);
      let nextCells = (curr.type !== type || (!isMulti && !isRange)) ? new Set<string>() : new Set<string>(curr.cells);

      if (type === 'row') {
        if (isMulti && nextRowIds.has(rowId)) {
          nextRowIds.delete(rowId);
        } else {
          nextRowIds.add(rowId);
        }
      } else if (type === 'cell' && field) {
        const coordKey = `${rowId}|${field}`;
        if (isMulti && nextCells.has(coordKey)) {
          nextCells.delete(coordKey);
        } else {
          nextCells.add(coordKey);
        }
      }

      const nextType = nextRowIds.size === 0 && nextCells.size === 0 ? null : type;

      return {
        type: nextType,
        rowIds: nextRowIds,
        cells: nextCells
      };
    });
  }

  public clearSelection(): void {
    this._state.set({
      type: null,
      rowIds: new Set<string>(),
      cells: new Set<string>(),
    });
  }

  public isRowSelected(rowId: string): boolean {
    return this._state().rowIds.has(rowId);
  }

  public isCellSelected(rowId: string, field: string): boolean {
    return this._state().cells.has(`${rowId}|${field}`);
  }
}
