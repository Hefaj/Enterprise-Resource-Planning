// apps/catalog/src/app/remote-entry/product-editor.component.ts
import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs'; // Nowość w PrimeNG 18+
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
// import { Catalog, ProductStore } from '@erp/catalog/data-access';
import { ProductTableComponent } from './product-table/product-table.component';

@Component({
  standalone: true,
  imports: [CommonModule, ProductTableComponent],
  template: ` <erp-product-table /> `,
})
export class ProductComponent {
  // public productName = signal('Laptop Pro X1');
  // public productSku = signal('LP-X1-2026');
  // public isSaving = signal(false);
  // public lastModified = signal(new Date());
  // public saveProduct(): void {
  //   this.isSaving.set(true);
  //   // Logika zapisu przez serwis
  //   setTimeout(() => this.isSaving.set(false), 1500);
  // }

  public constructor() {
    // const store = inject(ProductStore);
    // store.load();
  }
}
