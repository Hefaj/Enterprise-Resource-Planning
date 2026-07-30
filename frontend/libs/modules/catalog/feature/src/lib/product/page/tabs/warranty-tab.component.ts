import { ChangeDetectionStrategy, Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpTableComponent, ErpTableBuilder } from '@erp/shared/ui';

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
  imports: [CommonModule, ErpTableComponent],
  template: `
    <div class="flex flex-col h-full w-full overflow-hidden">
      <div class="flex-1 overflow-hidden">
        <erp-table
          class="block h-full"
          [config]="tableConfig"
        />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WarrantyTabComponent implements OnInit {
  items = signal<Warranty[]>([]);
  isLoading = signal(true);

  ngOnInit(): void {
    setTimeout(() => {
      this.items.set(generateWarranties(1000));
      this.isLoading.set(false);
    }, 400); // Simulate network latency and offload synchronous blocking
  }

  tableConfig = ErpTableBuilder.create<ErpTableBuilder<Warranty>>(table => {
    table
    .setMode('client') // Client mode for dummy data
    .setDefaultPageSize(100)
    .setEnableVirtualScroll(true)
    .setPageSizeOptions([5, 10, 20, 50, 500])
    // .setSelectionMode('single')
    .setSelectionMode('multi')
    // .setStriped(true)
    .setOnSelectionChange((state) => console.log(state))
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
