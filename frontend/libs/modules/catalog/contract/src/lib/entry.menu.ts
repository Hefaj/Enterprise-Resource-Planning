import { ErpNavigationItem } from '@erp/shared/data-access';
import { ERP_PERMISSIONS } from '@erp/shared/auth';

export const remoteMenu: ErpNavigationItem[] = [
  {
    // Globalny podgląd kondycji katalogu (braki w opisach, produkty bez zdjęć, statystyki kategorii).
    label: 'Dashboard Analityczny Produktów',
    iconId: 'chart-bar',
    route: 'products',
    requiredPermission: ERP_PERMISSIONS.Catalog.ProductRead,
  },
  {
    // Wszystkie pliki katalogu jako własne zasoby — jedyne miejsce, w którym widać (i da się
    // usunąć) plik nieużywany przez żaden produkt.
    label: 'Biblioteka mediów',
    iconId: 'image',
    route: 'multimedia',
    requiredPermission: ERP_PERMISSIONS.Catalog.DictionaryRead,
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
    iconId: 'copy',
    route: 'models',
  },
  {
    // Definiowanie cen bazowych oraz reguł czasowych (np. Black Friday).
    label: 'Zarządzanie Cennikami i Promocjami',
    iconId: 'percent',
    route: 'categories',
  },
  {
    // Wizualny edytor (PrimeNG Tree) do mapowania struktury menu i SEO.
    label: 'Kreator Drzewa Kategorii',
    iconId: 'network',
    route: 'brank-kind',
  },
  {
    label: 'shared.documentation.navigationLabel',
    labelKey: 'shared.documentation.navigationLabel',
    iconId: 'book-open',
    route: 'documentation',
    requiredPermission: ERP_PERMISSIONS.Catalog.ProductRead,
  },
];
