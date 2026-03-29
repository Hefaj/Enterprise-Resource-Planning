import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';

export interface TableColumn {
  field: string;
  header: string;
  type?: 'text' | 'currency' | 'date' | 'boolean';
  sortable?: boolean;
  filterable?: boolean;
}

export interface TableStateEvent {
  page: number;
  pageSize: number;
  sortField?: string;
  sortOrder?: number; // 1 (asc) lub -1 (desc)
}

@Component({
  selector: 'erp-table',
  imports: [TableModule],
  templateUrl: './erp-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
@Component({
  selector: 'erp-table',
  standalone: true,
  imports: [CommonModule, TableModule],
  templateUrl: './erp-table.component.html',
})
export class SmartTableComponent<T> {
  public data = input.required<T[]>();
  public columns = input.required<TableColumn[]>();
  public totalRecords = input.required<number>();
  public loading = input<boolean>(false);

  public fetchData = output<TableStateEvent>();

  public onLazyLoad(event: TableLazyLoadEvent): void {
    const page = event.first! / event.rows!;

    this.fetchData.emit({
      page: page + 1, // Backend zazwyczaj liczy od 1
      pageSize: event.rows || 0,
      sortField: event.sortField as string,
      sortOrder: event.sortOrder || undefined,
    });
  }
}
