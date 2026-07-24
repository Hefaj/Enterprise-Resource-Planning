import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TuiTablePagination, tuiTablePaginationOptionsProvider, type TuiTablePaginationEvent } from '@taiga-ui/addon-table';

@Component({
  selector: 'erp-table-pagination',
  standalone: true,
  imports: [
    TuiTablePagination,
  ],
  providers: [tuiTablePaginationOptionsProvider({showPages: false})],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="inline-flex items-center bg-(--erp-table-bg) p-2">
      <tui-table-pagination
        [total]="totalItems()"
        [items]="pageSizeOptions()"
        [page]="pageIndex()"
        [size]="pageSize()"
        (paginationChange)="onPaginationChange($event)"
      ></tui-table-pagination>
    </div>
  `
})
export class ErpTablePaginationComponent {
  pageIndex = input.required<number>();
  pageSize = input.required<number>();
  totalItems = input.required<number>();
  pageSizeOptions = input.required<number[]>();

  pageChange = output<{ pageIndex: number; pageSize: number }>();

  protected onPaginationChange(event: TuiTablePaginationEvent) {
    this.pageChange.emit({ pageIndex: event.page, pageSize: event.size });
  }
}
