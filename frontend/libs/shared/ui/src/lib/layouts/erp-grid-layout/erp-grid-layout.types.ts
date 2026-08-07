import { Type } from '@angular/core';
import { MaybeSignal } from '../../base/erp-signal-utils';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';

/** Definicja siatki CSS Grid — przekazywana do setGrid() */
export interface ErpGridDefinition {
  /** Tablica stringów definiujących grid-template-areas */
  areas: string[];
  /** grid-template-columns (np. '280px 1fr 0fr') */
  columns: string;
  /** grid-template-rows (np. 'auto 1fr') */
  rows: string;
  /** Gap pomiędzy elementami grida (domyślnie '0') */
  gap?: string;
}

/** Opcje zachowania dla pojedynczego obszaru grida */
export interface ErpGridAreaOptions {
  /** Kierunek resizera: 'left' | 'right' | 'top' | 'bottom' | false */
  resizable?: 'left' | 'right' | 'top' | 'bottom' | false;
  /** Minimalna szerokość (px) — dotyczy kolumn z resizerem */
  minWidth?: MaybeSignal<number>;
  /** Maksymalna szerokość (px) — dotyczy kolumn z resizerem */
  maxWidth?: MaybeSignal<number>;
  /** Minimalna wysokość (px) — dotyczy rzędów z resizerem */
  minHeight?: MaybeSignal<number>;
  /** Maksymalna wysokość (px) — dotyczy rzędów z resizerem */
  maxHeight?: MaybeSignal<number>;
  /** Stan zwinięcia — statyczny boolean lub Signal/computed */
  collapsed?: MaybeSignal<boolean>;
  /** Niestandardowa klasa CSS dla kontenera area */
  cssClass?: string;
  /** Styl border dla area (domyślnie 'none') */
  border?: 'left' | 'right' | 'top' | 'bottom' | 'all' | 'none';
}

/** Definicja jednego wypełnionego obszaru grida */
export interface ErpGridAreaSlot<TComponent = any> {
  /** Nazwa area z CSS Grid */
  areaName: string;
  /** Referencja do komponentu Angular */
  component: Type<TComponent>;
  /** Silnie typowane inputy komponentu */
  inputs?: ErpComponentSignalInputs<TComponent>;
  /** Opcje zachowania */
  options?: ErpGridAreaOptions;
}

/** Główna konfiguracja erp-grid-layout */
export interface ErpGridLayoutConfig {
  /** Definicja siatki */
  grid: ErpGridDefinition;
  /** Mapa wypełnionych obszarów: klucz = nazwa area */
  areas: Map<string, ErpGridAreaSlot>;
  /** ID layoutu do zapisu preferencji użytkownika */
  layoutId?: string;
  /** Czy wymusić obramowanie dla wszystkich sekcji */
  showBorders?: boolean;
}
