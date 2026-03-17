import { ErpNavigationItem } from '@erp/shared/data-access';

export const remoteMenu: ErpNavigationItem[] = [
  {
    // Mapa Magazynu (Digital Twin): Wizualizacja sektorów i regałów. Wykorzystanie Canvas lub SVG do podglądu obłożenia miejsc składowych.
    label: 'Mapa Magazynu',
    iconId: 'map',
    route: 'products2',
  },
  {
    // (Inbound): Proces skanowania dostaw, weryfikacja zgodności z zamówieniem i generowanie etykiet logistycznych.
    label: 'Przyjęcia Zewnętrzne',
    iconId: 'download',
    route: 'producers2',
  },
  {
    // (Picking): Widok zoptymalizowany pod urządzenia mobilne (Tailwind v4 Mobile-first) dla magazynierów.
    label: 'Panel Kompletacji Zamówień',
    iconId: 'check-square',
    route: 'models2',
  },
  {
    // Moduł do cyklicznych spisów z natury i automatycznego rozliczania różnic.
    label: 'Zarządzanie Inwentaryzacją',
    iconId: 'calculator',
    route: 'categories2',
  },
  {
    // (Outbound): Zarządzanie pakowaniem, integracja z kurierami i generowanie listów przewozowych.
    label: 'Kolejka Wysyłek',
    iconId: 'send',
    route: 'categories2',
  },
];
