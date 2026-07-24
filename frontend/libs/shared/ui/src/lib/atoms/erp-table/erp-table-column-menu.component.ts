import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiDropdown, TuiDataList, TuiIcon } from '@taiga-ui/core';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';

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
        @for (col of columns(); track col.id) {
          <div tuiOption cdkDrag class="flex items-center justify-between gap-4 w-full group !p-0">
            <div 
              class="flex items-center gap-2 cursor-pointer flex-1 py-2 px-3 overflow-hidden" 
              [class.opacity-50]="col.disableHiding"
              (click)="!col.disableHiding && toggleColumn(col.id, !col.visible)"
            >
              <tui-icon
                cdkDragHandle
                icon="@tui.grip-vertical"
                class="w-4 h-4 cursor-move text-(--tui-text-tertiary) hover:text-(--tui-text-action) shrink-0"
                (click)="$event.stopPropagation()"
              />
              <tui-icon
                [icon]="col.visible ? '@tui.eye' : '@tui.eye-off'"
                class="w-4 h-4 shrink-0 transition-colors"
                [class.text-(--tui-text-action)]="col.visible"
                [class.text-(--tui-text-tertiary)]="!col.visible"
              />
              <span class="truncate">{{ col.header }}</span>
            </div>
            
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-3" [class.!opacity-100]="col.pin">
              <tui-icon
                icon="@tui.arrow-left"
                class="w-4 h-4 cursor-pointer hover:text-(--tui-text-action)"
                [class.text-(--tui-text-action)]="col.pin === 'left'"
                (click)="togglePin($event, col.id, col.pin === 'left' ? false : 'left')"
                title="Przypnij do lewej"
              />
              <tui-icon
                icon="@tui.arrow-right"
                class="w-4 h-4 cursor-pointer hover:text-(--tui-text-action)"
                [class.text-(--tui-text-action)]="col.pin === 'right'"
                (click)="togglePin($event, col.id, col.pin === 'right' ? false : 'right')"
                title="Przypnij do prawej"
              />
            </div>
          </div>
        }
      </tui-data-list>
    </ng-template>
  `
})
export class ErpTableColumnMenuComponent {
  columns = input.required<{ id: string; header: string; visible: boolean; disableHiding: boolean; pin: 'left' | 'right' | false }[]>();
  
  visibilityChange = output<{ id: string; visible: boolean }>();
  pinChange = output<{ id: string; pin: 'left' | 'right' | false }>();
  orderChange = output<string[]>();

  protected open = signal(false);

  protected toggleColumn(id: string, visible: boolean) {
    this.visibilityChange.emit({ id, visible });
  }

  protected togglePin(event: Event, id: string, pin: 'left' | 'right' | false) {
    event.stopPropagation();
    event.preventDefault();
    this.pinChange.emit({ id, pin });
  }

  protected onDrop(event: CdkDragDrop<any>) {
    const newOrder = [...this.columns()];
    moveItemInArray(newOrder, event.previousIndex, event.currentIndex);
    this.orderChange.emit(newOrder.map(c => c.id));
  }
}
