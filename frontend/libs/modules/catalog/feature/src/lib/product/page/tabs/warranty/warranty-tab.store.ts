import { Injectable, signal } from '@angular/core';

@Injectable() // Rejestrowany na poziomie WarrantyTabComponent, aby żył tylko tyle co zakładka
export class WarrantyTabStore {
  // Zaznaczenia gwarancji (jedna wspólna tabela grupowana per produkt)
  public readonly selectedWarrantiesByProduct = signal<Record<string, string[]>>({});

  public setAllWarrantySelections(dict: Record<string, string[]>): void {
    this.selectedWarrantiesByProduct.set(dict);
  }

  public clearWarrantySelection(): void {
    this.selectedWarrantiesByProduct.set({});
  }

  public getAllSelectedWarrantiesCount(): number {
    const dict = this.selectedWarrantiesByProduct();
    return Object.values(dict).reduce((acc, curr) => acc + curr.length, 0);
  }
}
