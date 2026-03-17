import { ErpNavigationItem } from '@erp/shared/data-access';

export const remoteMenu: ErpNavigationItem[] = [
  {
    // Globalny podgląd kondycji katalogu (braki w opisach, produkty bez zdjęć, statystyki kategorii).
    label: 'Dashboard Analityczny Produktów',
    iconId: 'chart-bar',
    route: 'products',
  },
  {
    // (PIM): Zaawansowany grid (PrimeNG Table) z filtrowaniem, pozwalający na edycję parametrów technicznych i marketingowych.
    label: 'Manager Produktów',
    iconId: 'box',
    route: 'producers',
  },
  {
    // Zarządzanie cechami dynamicznymi (kolory, rozmiary) – wykorzystanie JSON Column w .NET 10 dla elastyczności.
    label: 'Konfigurator Atrybutów i Wariantów',
    iconId: 'clone',
    route: 'models',
  },
  {
    // Definiowanie cen bazowych oraz reguł czasowych (np. Black Friday).
    label: 'Zarządzanie Cennikami i Promocjami',
    iconId: 'percentage',
    route: 'categories',
  },
  {
    // Wizualny edytor (PrimeNG Tree) do mapowania struktury menu i SEO.
    label: 'Kreator Drzewa Kategorii',
    iconId: 'sitemap',
    route: 'brank-kind',
  },
];
