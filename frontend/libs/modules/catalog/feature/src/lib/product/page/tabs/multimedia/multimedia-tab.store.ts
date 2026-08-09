import { Injectable, signal } from '@angular/core';

@Injectable() // Rejestrowany na poziomie MultimediaTabComponent, aby żył tylko tyle co zakładka
export class MultimediaTabStore {
  // Zaznaczenia multimediów (płaska lista — jedna wspólna tabela grupowana per produkt)
  public readonly selectedMultimedia = signal<Set<string>>(new Set());
}
