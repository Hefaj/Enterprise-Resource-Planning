export type SelectionType = 'row' | 'cell';

export interface CellCoord {
  rowId: string;
  field: string;
}

export interface SelectionState {
  type: SelectionType | null;
  rowIds: Set<string>;
  cells: Set<string>; // klucz: "rowId|field"
}
