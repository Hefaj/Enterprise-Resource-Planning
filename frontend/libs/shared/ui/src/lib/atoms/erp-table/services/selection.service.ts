import { Injectable, signal, computed } from '@angular/core';
import { SelectionState, SelectionType, CellCoord } from '../models/selection.models';

@Injectable()
export class SelectionService {
  private _state = signal<SelectionState>({
    type: null,
    rowIds: new Set<string>(),
    cells: new Set<string>(),
  });

  public readonly selection = this._state.asReadonly();

  public select(rowId: string, type: SelectionType, field?: string, isCtrl = false): void {
    this._state.update((curr) => {
      let newState = { ...curr };

      // Jeśli zmieniamy typ zaznaczenia, czyścimy poprzednie
      if (curr.type !== type) {
        newState = { type, rowIds: new Set(), cells: new Set() };
      } else if (!isCtrl) {
        // Jeśli nie ctrl, czyścimy
        newState.rowIds = new Set();
        newState.cells = new Set();
      }

      if (type === 'row') {
        if (newState.rowIds.has(rowId)) {
          newState.rowIds.delete(rowId);
        } else {
          newState.rowIds.add(rowId);
        }
      } else if (type === 'cell' && field) {
        const coordKey = `${rowId}|${field}`;
        if (newState.cells.has(coordKey)) {
          newState.cells.delete(coordKey);
        } else {
          newState.cells.add(coordKey);
        }
      }

      // Jeśli puste, czyścimy typ
      if (newState.rowIds.size === 0 && newState.cells.size === 0) {
        newState.type = null;
      }

      return newState;
    });
  }

  public isRowSelected(rowId: string): boolean {
    return this._state().rowIds.has(rowId);
  }

  public isCellSelected(rowId: string, field: string): boolean {
    return this._state().cells.has(`${rowId}|${field}`);
  }
}
