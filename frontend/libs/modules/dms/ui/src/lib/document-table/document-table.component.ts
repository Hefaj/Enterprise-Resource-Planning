import { ChangeDetectionStrategy, Component, model, output } from '@angular/core';
import { ErpTableComponent, ErpTableBuilder, ErpTableFilters } from '@erp/shared/ui';

export interface DmsDocument {
  id: string;
  name: string;
  type: string;
  status: 'Szkic' | 'W obiegu' | 'Zatwierdzony' | 'Odrzucony' | 'Archiwum';
  author: string;
  createdAt: Date;
  updatedAt: Date;
  size?: string;
}

@Component({
  selector: 'dms-document-table',
  standalone: true,
  imports: [ErpTableComponent],
  template: `
    <erp-table 
      [config]="tableConfig"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentTableComponent {
  /** Dane dokumentów */
  public data = model<DmsDocument[]>([]);

  /** Aktualnie zaznaczone wiersze */
  public selection = model<DmsDocument | DmsDocument[] | null>(null);

  /** Filtry zewnętrzne */
  public externalFilters = model<ErpTableFilters>({});

  /** Stan ładowania */
  public loading = model<boolean>(false);

  protected readonly tableConfig = ErpTableBuilder.create(b => b
    .addColumn('name', 'Nazwa dokumentu', { sortable: true, minWidth: '250px' })
    .addColumn('type', 'Typ', { sortable: true, width: '150px' })
    .addBadgeColumn('status', 'Status', {
      'Szkic': 'secondary',
      'W obiegu': 'info',
      'Zatwierdzony': 'success',
      'Odrzucony': 'danger',
      'Archiwum': 'contrast',
    }, { sortable: true, width: '150px' })
    .addColumn('author', 'Autor', { sortable: true, width: '160px' })
    .addColumn('createdAt', 'Utworzony', { sortable: true, pipe: 'date', width: '140px' })
    .addColumn('updatedAt', 'Zaktualizowany', { sortable: true, pipe: 'date', width: '160px' })
    .addColumn('size', 'Rozmiar', { width: '100px', align: 'right' })
    .setPagination(15, [10, 15, 25, 50])
    .setGlobalFilter(['name', 'type', 'status', 'author'])
    .setEmptyMessage('Brak dokumentów')
    .setSize('small')
    .setSelectionMode('multiple')
    .setData(this.data)
    .setExternalFilters(this.externalFilters)
    .setLoading(this.loading)
    .setSelection(this.selection)
  );
}
