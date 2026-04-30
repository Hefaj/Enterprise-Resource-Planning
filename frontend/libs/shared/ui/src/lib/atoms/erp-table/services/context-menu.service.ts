import { Injectable } from '@angular/core';
import { ContextMenuItem } from '../models/context-menu.models';
import { SelectionState } from '../models/selection.models';

export type MenuEntry = ContextMenuItem | 'separator';

@Injectable({ providedIn: 'root' })
export class ContextMenuService {
  public processItems(items: ContextMenuItem[], selection: SelectionState, filter = ''): MenuEntry[] {
    // 1. Filtrowanie (uwzględniając dostępność i widoczność)
    const filtered = items.filter((i) => i.label.toLowerCase().includes(filter.toLowerCase()) && (i.visible?.(selection) ?? true));

    // 2. Grupowanie
    const result: MenuEntry[] = [];
    const groups = new Map<string, ContextMenuItem[]>();
    const defaultGroup = 'default';

    filtered.forEach((item) => {
      const gId = item.groupId ?? defaultGroup;
      if (!groups.has(gId)) groups.set(gId, []);
      groups.get(gId)!.push(item);
    });

    // 3. Budowanie płaskiej listy z separatorami
    const groupKeys = Array.from(groups.keys());
    groupKeys.forEach((gId, index) => {
      const groupItems = groups.get(gId)!;

      // Dodaj separator, jeśli to nie pierwsza grupa
      if (index > 0) {
        result.push('separator');
      }

      result.push(...groupItems);
    });

    return result;
  }
}
