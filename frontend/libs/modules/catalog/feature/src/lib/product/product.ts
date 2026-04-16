// apps/catalog/src/app/remote-entry/product-editor.component.ts
import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs'; // Nowość w PrimeNG 18+
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { Catalog } from '@erp/catalog/data-access';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, TabsModule, InputTextModule, MessageModule],
  template: `
    <div class="p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <header class="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 class="text-2xl font-bold text-slate-800">Edycja Produktu: {{ productSku() }}</h1>
          <p class="text-slate-500 text-sm">Ostatnia modyfikacja: {{ lastModified() | date: 'short' }}</p>
        </div>
        <div class="flex gap-3">
          <p-button
            label="Anuluj"
            severity="secondary"
            variant="outlined"
          />
          <p-button
            label="Zapisz zmiany"
            icon="pi pi-check"
            (onClick)="saveProduct()"
            [loading]="isSaving()"
          />
        </div>
      </header>

      <div class="grid grid-cols-12 gap-6">
        <div class="col-span-12 lg:col-span-9 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <p-tabs value="0">
            <p-tablist>
              <p-tab value="0">Ogólne</p-tab>
              <p-tab value="1">Ceny i Magazyn</p-tab>
              <p-tab value="2">Media</p-tab>
            </p-tablist>
            <p-tabpanels>
              <p-tabpanel value="0">
                <div class="flex flex-col gap-4 p-4">
                  <div class="flex flex-col gap-2">
                    <label class="font-semibold">Nazwa produktu</label>
                    <input
                      pInputText
                      [(ngModel)]="productName"
                      class="w-full"
                    />
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                    <div class="p-4 rounded-lg bg-blue-50 border border-blue-100 italic">Wskazówka: Użyj słów kluczowych dla lepszego SEO.</div>
                  </div>
                </div>
              </p-tabpanel>
            </p-tabpanels>
          </p-tabs>
        </div>

        <div class="col-span-12 lg:col-span-3 flex flex-col gap-6">
          <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <h3 class="font-bold mb-4">Status</h3>
            <div class="flex items-center gap-2 text-green-600">
              <span class="relative flex h-3 w-3">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              Aktywny w sklepie
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ProductComponent {
  public productName = signal('Laptop Pro X1');
  public productSku = signal('LP-X1-2026');
  public isSaving = signal(false);
  public lastModified = signal(new Date());
  public saveProduct(): void {
    this.isSaving.set(true);
    // Logika zapisu przez serwis
    setTimeout(() => this.isSaving.set(false), 1500);
  }

  public constructor() {
    const api = inject(Catalog.ProductClient);
    api.catalogBffProductQueryGetProductEndpoint({});
  }
}
