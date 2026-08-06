import { ChangeDetectionStrategy, Component, signal, computed, OnInit, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  ErpTableComponent, 
  ErpTableBuilder,
  ErpActionToolbarComponent, 
  ErpActionToolbarBuilder, 
  ErpActionToolbarZoneDirective, 
  ErpActionToolbarContextDirective, 
  ErpSelectionState
} from '@erp/shared/ui';

interface Warranty {
  id: string;
  serialNumber: string;
  productName: string;
  provider: string;
  durationMonths: number;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Expired' | 'Pending' | 'Claimed';
  notes: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  location: string;
  department: string;
  costCenter: string;
  purchaseOrderNumber: string;
  invoiceNumber: string;
  purchasePrice: number;
  currency: string;
}

function generateWarranties(count: number): Warranty[] {
  const statuses: Warranty['status'][] = ['Active', 'Expired', 'Pending', 'Claimed'];
  const providers = ['Lenovo', 'LG', 'Logitech', 'Dell', 'HP', 'Apple', 'Cisco', 'Samsung', 'ASUS', 'Synology'];
  const products = ['Laptop X1 Carbon', 'Monitor UltraWide', 'Mysz', 'Klawiatura', 'Serwer', 'Drukarka', 'MacBook Pro', 'Router', 'Słuchawki', 'Kamera'];

  return Array.from({ length: count }, (_, index) => {
    const id = `W-${String(index + 1).padStart(3, '0')}`;
    const durationMonths = [12, 24, 36, 48, 60][index % 5];
    
    return {
      id,
      serialNumber: `SN-${Math.floor(1000000 + Math.random() * 9000000)}-${id}`,
      productName: `${products[index % products.length]} ${index + 1}`,
      provider: providers[index % providers.length],
      durationMonths,
      startDate: `2023-01-${String((index % 28) + 1).padStart(2, '0')}`,
      endDate: `2026-01-${String((index % 28) + 1).padStart(2, '0')}`,
      status: statuses[index % statuses.length],
      notes: index % 2 === 0 ? 'Standardowa gwarancja' : 'Wsparcie Premium NBD.',
      contactPerson: `Jan Kowalski ${index + 1}`,
      contactEmail: `jan.kowalski${index + 1}@example.com`,
      contactPhone: `+48 123 456 78${index % 10}`,
      location: index % 2 === 0 ? 'Warszawa HQ' : 'Kraków Branch',
      department: index % 3 === 0 ? 'IT' : 'Sales',
      costCenter: `CC-${1000 + index}`,
      purchaseOrderNumber: `PO-2023-${100 + index}`,
      invoiceNumber: `FV/2023/${50 + index}`,
      purchasePrice: 1500 + (index * 150),
      currency: 'PLN'
    };
  });
}

@Component({
  selector: 'erp-warranty-tab',
  standalone: true,
  imports: [
    CommonModule, 
    ErpTableComponent,
    ErpActionToolbarComponent,
    ErpActionToolbarZoneDirective,
    ErpActionToolbarContextDirective
  ],
  template: `
    <div class="h-full w-full p-2">
      <div class="flex flex-col gap-2 h-full w-full" erpActionToolbarZone [erpActionToolbarContext]="actionToolbar">
        <erp-action-toolbar [config]="actionToolbar" />
        <div class="flex-1 overflow-hidden" >
          <erp-table
            class="block h-full"
            [config]="tableConfig"
          />
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WarrantyTabComponent implements OnInit {
  private readonly table = viewChild(ErpTableComponent);

  items = signal<Warranty[]>([]);
  isLoading = signal(true);
  selection = signal<ErpSelectionState<Warranty> | null>(null);

  protected readonly selectionCount = computed(() => this.selection()?.selectedItems?.length ?? 0);

  protected readonly actionToolbar = ErpActionToolbarBuilder.create((b) =>
    b
      .setMenuId('warranty-tab-toolbar')
      // --- GRUPY DOMYŚLNE ---
      .addDefaultGroup((g) =>
        g
          .setId('crud')
          .setLabel('Akcje')
          .setIcon('@tui.layers')
          .addAction((a) =>
            a
              .setId('add')
              .setLabel('Dodaj nową gwarancję')
              .setIcon('@tui.plus')
              .setShortcut('Ctrl+N')
              .setAppearance('success')
              .setFn(() => console.log('Dodaj nową gwarancję'))
          )
          .addAction((a) =>
            a
              .setId('duplicate')
              .setLabel('Duplikuj układ')
              .setIcon('@tui.copy')
              .setShortcut('Ctrl+D')
              .setFn(() => console.log('Duplikuj'))
          )
      )
      .addDefaultGroup((g) =>
        g
          .setId('import-export')
          .setLabel('Eksport i Import')
          .setIcon('@tui.download')
          .addAction((a) =>
            a
              .setId('export-csv')
              .setLabel('Eksportuj do CSV')
              .setIcon('@tui.file-text')
              .setFn(() => console.log('Eksport CSV'))
          )
          .addAction((a) =>
            a
              .setId('export-xml')
              .setLabel('Eksportuj do XML')
              .setIcon('@tui.file-code')
              .setFn(() => console.log('Eksport XML'))
          )
          .addAction((a) =>
            a
              .setId('import')
              .setLabel('Importuj z pliku')
              .setIcon('@tui.upload')
              .setSeparator(true)
              .setFn(() => console.log('Import'))
          )
      )
      .addDefaultGroup((g) =>
        g
          .setId('view-options')
          .setLabel('Opcje widoku')
          .setIcon('@tui.eye')
          .addAction((a) =>
            a
              .setId('refresh')
              .setLabel('Odśwież listę')
              .setIcon('@tui.refresh-cw')
              .setShortcut('F5')
              .setAppearance('info')
              .setFn(() => console.log('Odświeżam'))
          )
          .addAction((a) =>
            a
              .setId('view-archived')
              .setLabel('Pokaż archiwalne')
              .setIcon('@tui.archive')
              .setFn(() => console.log('Pokaż archiwalne'))
          )
          .addAction((a) =>
            a
              .setId('extended-view')
              .setLabel('Rozszerzony widok tabeli')
              .setIcon('@tui.maximize')
              .setFn(() => console.log('Rozszerzony widok'))
          )
      )
      // --- GRUPY ZAZNACZENIA ---
      .addSelectionGroup((g) =>
        g
          .setId('bulk-edit')
          .setLabel('Edycja masowa')
          .setIcon('@tui.pencil')
          .addAction((a) =>
            a
              .setId('set-status')
              .setLabel('Zmień status')
              .setIcon('@tui.activity')
              .setShortcut('Ctrl+E')
              .setFn(() => console.log('Zmień status'))
          )
      )
      // --- USTAWIENIA DODATKOWE ---
      .setSelectionCount(this.selectionCount)
      .setSelectionLabel('Wybrano gwarancji')
      .setOnClearSelection(() => {
         this.selection.set(null);
         this.table()?.clearSelection();
      })
      .setPinnedActionIds(['add', 'set-status'])
      .setEnableContextMenu(true)
  );

  ngOnInit(): void {
    setTimeout(() => {
      this.items.set(generateWarranties(1000));
      this.isLoading.set(false);
    }, 400); // Simulate network latency and offload synchronous blocking
  }

  tableConfig = ErpTableBuilder.create<ErpTableBuilder<Warranty>>(table => {
    table
    .setMode('client') // Client mode for dummy data
    .setDefaultPageSize(20)
    .setEnableVirtualScroll(true)
    .setPageSizeOptions([5, 10, 20, 50, 500])
    // .setSelectionMode('single')
    .setSelectionMode('multi')
    // .setStriped(true)
    .setOnSelectionChange((state) => {
      console.log(state);
      this.selection.set(state);
    })
    .setLoading(this.isLoading)
    .setItems(this.items)
    .setItemCount(computed(() => this.items().length))
    .addColumn(c => c
      .setId('id')
      .setDisableHiding(true)
      .setAccessorKey('id')
      .setHeader('ID Gwarancji')
      .setSize(110)
    )
    .addColumn(c => c
      .setId('serialNumber')
      .setAccessorKey('serialNumber')
      .setHeader('Numer Seryjny')
      .setSize(140)
    )
    .addColumn(c => c
      .setId('productName')
      .setAccessorKey('productName')
      .setHeader('Nazwa Produktu (Sprzęt / Urządzenie)')
      .setSize(260)
    )
    .addColumn(c => c
      .setId('provider')
      .setAccessorKey('provider')
      .setHeader('Dostawca Gwarancji / Producent')
      .setSize(220)
    )
    .addColumn(c => c
      .setId('durationMonths')
      .setAccessorKey('durationMonths')
      .setHeader('Okres (mc)')
      .setCellClass('text-right')
      .setSize(100)
    )
    .addColumn(c => c
      .setId('startDate')
      .setAccessorKey('startDate')
      .setHeader('Data Początkowa')
      .setSize(130)
    )
    .addColumn(c => c
      .setId('endDate')
      .setAccessorKey('endDate')
      .setHeader('Data Końcowa')
      .setSize(130)
    )
    .addColumn(c => c
      .setId('status')
      .setAccessorKey('status')
      .setFooter('Podsumowanie testowe i inne takie tam elementy które mają być w footerze tej kolumny')
      .setHeader('Status Gwarancji')
      .setSize(150)
    )
    .addColumn(c => c
      .setId('notes')
      .setAccessorKey('notes')
      .setHeader('Uwagi i Szczegółowe Warunki Serwisowe')
      .setSize(350)
    )
    .addColumn(c => c
      .setId('contactPerson')
      .setAccessorKey('contactPerson')
      .setHeader('Osoba Kontaktowa')
      .setSize(180)
    )
    .addColumn(c => c
      .setId('contactEmail')
      .setAccessorKey('contactEmail')
      .setHeader('Email Kontaktowy')
      .setSize(200)
    )
    .addColumn(c => c
      .setId('contactPhone')
      .setAccessorKey('contactPhone')
      .setHeader('Telefon Kontaktowy')
      .setSize(160)
    )
    .addColumn(c => c
      .setId('location')
      .setAccessorKey('location')
      .setHeader('Lokalizacja')
      .setSize(150)
    )
    .addColumn(c => c
      .setId('department')
      .setAccessorKey('department')
      .setHeader('Dział')
      .setSize(130)
    )
    .addColumn(c => c
      .setId('costCenter')
      .setAccessorKey('costCenter')
      .setHeader('MPK')
      .setSize(110)
    )
    .addColumn(c => c
      .setId('purchaseOrderNumber')
      .setAccessorKey('purchaseOrderNumber')
      .setHeader('Numer Zamówienia')
      .setSize(170)
    )
    .addColumn(c => c
      .setId('invoiceNumber')
      .setAccessorKey('invoiceNumber')
      .setHeader('Numer Faktury')
      .setSize(160)
    )
    .addColumn(c => c
      .setId('purchasePrice')
      .setAccessorKey('purchasePrice')
      .setHeader('Cena Zakupu')
      .setCellClass('text-right')
      .setSize(120)
    )
    .addColumn(c => c
      .setId('currency')
      .setAccessorKey('currency')
      .setHeader('Waluta')
      .setSize(90)
    )
  });
}
