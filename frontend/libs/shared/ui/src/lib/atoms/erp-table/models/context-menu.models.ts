import { SelectionState } from '../models/selection.models';

export interface ContextMenuItem {
  id: string;
  label: string;
  groupId?: string;
  icon?: string;
  command?: (selection: SelectionState) => void;
  items?: ContextMenuItem[];
  disabled?: (selection: SelectionState) => boolean;
  visible?: (selection: SelectionState) => boolean;
  showSearch?: boolean;
}

export interface TableContextMenuConfig {
  globalItems: ContextMenuItem[]; // Opcje zawsze dostępne
  dynamicItems: ContextMenuItem[]; // Opcje aktywowane kontekstem zaznaczenia
}
