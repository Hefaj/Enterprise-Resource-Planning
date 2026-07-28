import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiDropdown, TuiDataList, TuiIcon } from '@taiga-ui/core';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';

export interface ErpColumnMenuItem {
  id: string;
  header: string;
  visible: boolean;
  disableHiding: boolean;
  isGroup?: boolean;
  children?: ErpColumnMenuItem[];
}

@Component({
  selector: 'erp-table-column-menu',
  standalone: true,
  imports: [
    FormsModule,
    TuiButton,
    TuiDropdown,
    TuiDataList,
    TuiIcon,
    CdkDrag,
    CdkDropList,
    CdkDragHandle,
    ErpTranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      tuiButton
      appearance="outline"
      size="s"
      iconStart="@tui.columns"
      [tuiDropdown]="dropdown"
      [tuiDropdownOpen]="open()"
      (tuiDropdownOpenChange)="open.set($event)"
    >
      {{ 'shared.table.columnVisibility' | erpTranslate }}
    </button>

    <ng-template #dropdown>
      <tui-data-list cdkDropList (cdkDropListDropped)="onDrop($event)">
        @for (item of columns(); track item.id) {
          @if (item.isGroup) {
            <div tuiOption cdkDrag class="flex flex-col w-full !p-0 border-b border-(--tui-border-normal) last:border-b-0">
              <div class="flex items-center justify-between gap-4 w-full p-2 px-3 bg-(--tui-background-neutral-1) cursor-pointer hover:bg-(--tui-background-neutral-1-hover) group/parent" (click)="toggleCollapse(item.id, $event)">
                <div 
                  class="flex items-center gap-2 flex-1 overflow-hidden"
                  [class.opacity-50]="item.disableHiding"
                >
                  <tui-icon
                    cdkDragHandle
                    icon="@tui.grip-vertical"
                    class="w-4 h-4 cursor-move text-(--tui-text-tertiary) hover:text-(--tui-text-action) shrink-0"
                    (click)="$event.stopPropagation()"
                  />
                  <tui-icon
                    [icon]="item.visible ? '@tui.eye' : '@tui.eye-off'"
                    class="w-4 h-4 shrink-0 transition-colors cursor-pointer hover:text-(--tui-text-action)"
                    [class.text-(--tui-text-action)]="item.visible"
                    [class.text-(--tui-text-tertiary)]="!item.visible"
                    (click)="$event.stopPropagation(); !item.disableHiding && toggleGroup(item, !item.visible)"
                  />
                  <span class="truncate font-semibold">{{ item.header | erpTranslate }}</span>
                </div>
                <tui-icon
                  [icon]="collapsedGroups()[item.id] ? '@tui.chevron-right' : '@tui.chevron-down'"
                  class="w-4 h-4 shrink-0 text-(--tui-text-secondary)"
                />
              </div>
              <div class="flex flex-col pl-6" cdkDropList (cdkDropListDropped)="onDropChild($event, item)" [class.hidden]="collapsedGroups()[item.id]">
                @for (child of item.children; track child.id) {
                  <div cdkDrag class="flex items-center justify-between gap-4 w-full group py-2 px-3 border-t border-(--tui-border-normal) first:border-t-0 hover:bg-(--tui-background-neutral-1-hover)">
                    <div 
                      class="flex items-center gap-2 cursor-pointer flex-1 overflow-hidden" 
                      [class.opacity-50]="child.disableHiding"
                      (click)="!child.disableHiding && toggleColumn(child.id, !child.visible)"
                    >
                      <tui-icon
                        cdkDragHandle
                        icon="@tui.grip-vertical"
                        class="w-4 h-4 cursor-move text-(--tui-text-tertiary) hover:text-(--tui-text-action) shrink-0"
                        (click)="$event.stopPropagation()"
                      />
                      <tui-icon
                        [icon]="child.visible ? '@tui.eye' : '@tui.eye-off'"
                        class="w-4 h-4 shrink-0 transition-colors"
                        [class.text-(--tui-text-action)]="child.visible"
                        [class.text-(--tui-text-tertiary)]="!child.visible"
                      />
                      <span class="truncate">{{ child.header | erpTranslate }}</span>
                    </div>
                    
                  </div>
                }
              </div>
            </div>
          } @else {
            <div tuiOption cdkDrag class="flex items-center justify-between gap-4 w-full group !p-0 border-b border-(--tui-border-normal) last:border-b-0 hover:bg-(--tui-background-neutral-1-hover)">
              <div 
                class="flex items-center gap-2 cursor-pointer flex-1 py-2 px-3 overflow-hidden" 
                [class.opacity-50]="item.disableHiding"
                (click)="!item.disableHiding && toggleColumn(item.id, !item.visible)"
              >
                <tui-icon
                  cdkDragHandle
                  icon="@tui.grip-vertical"
                  class="w-4 h-4 cursor-move text-(--tui-text-tertiary) hover:text-(--tui-text-action) shrink-0"
                  (click)="$event.stopPropagation()"
                />
                <tui-icon
                  [icon]="item.visible ? '@tui.eye' : '@tui.eye-off'"
                  class="w-4 h-4 shrink-0 transition-colors"
                  [class.text-(--tui-text-action)]="item.visible"
                  [class.text-(--tui-text-tertiary)]="!item.visible"
                />
                <span class="truncate">{{ item.header | erpTranslate }}</span>
              </div>
            </div>
          }
        }
      </tui-data-list>
    </ng-template>
  `
})
export class ErpTableColumnMenuComponent {
  columns = input.required<ErpColumnMenuItem[]>();
  
  visibilityChange = output<{ id: string; visible: boolean }[]>();
  orderChange = output<string[]>();

  protected open = signal(false);
  protected collapsedGroups = signal<Record<string, boolean>>({});

  protected toggleCollapse(id: string, event: Event) {
    event.stopPropagation();
    this.collapsedGroups.update(state => ({
      ...state,
      [id]: !state[id]
    }));
  }

  protected toggleColumn(id: string, visible: boolean) {
    this.visibilityChange.emit([{ id, visible }]);
  }

  protected toggleGroup(item: ErpColumnMenuItem, visible: boolean) {
    if (!item.children) return;
    const changes: { id: string; visible: boolean }[] = [];
    for (const child of item.children) {
      if (!child.disableHiding) {
        changes.push({ id: child.id, visible });
      }
    }
    this.visibilityChange.emit(changes);
  }

  protected onDrop(event: CdkDragDrop<any>) {
    const newOrder = [...this.columns()];
    moveItemInArray(newOrder, event.previousIndex, event.currentIndex);
    
    // Flatten the order to extract leaf column IDs
    const flatOrder: string[] = [];
    for (const item of newOrder) {
      if (item.isGroup && item.children) {
        flatOrder.push(...item.children.map(c => c.id));
      } else {
        flatOrder.push(item.id);
      }
    }
    
    this.orderChange.emit(flatOrder);
  }

  protected onDropChild(event: CdkDragDrop<any>, parentGroup: ErpColumnMenuItem) {
    if (event.previousIndex === event.currentIndex) return;

    const newColumns = [...this.columns()];
    const groupIndex = newColumns.findIndex(c => c.id === parentGroup.id);
    if (groupIndex === -1 || !newColumns[groupIndex].children) return;

    const newChildren = [...newColumns[groupIndex].children!];
    moveItemInArray(newChildren, event.previousIndex, event.currentIndex);
    
    newColumns[groupIndex] = { ...newColumns[groupIndex], children: newChildren };

    const flatOrder: string[] = [];
    for (const item of newColumns) {
      if (item.isGroup && item.children) {
        flatOrder.push(...item.children.map(c => c.id));
      } else {
        flatOrder.push(item.id);
      }
    }
    
    this.orderChange.emit(flatOrder);
  }
}

