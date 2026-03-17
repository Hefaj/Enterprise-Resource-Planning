import { ErpNavigationItem } from '@erp/shared/data-access';

export const remoteMenu: ErpNavigationItem[] = [
  {
    // (OMS): Widok 360° zamówienia – statusy, płatności, historia zmian i komunikacja z klientem.
    label: 'Centrum Obsługi Zamówień',
    iconId: 'shopping-cart',
    route: 'products3',
  },
  {
    // (RMA): Workflow decyzyjny dotyczący przyjmowania zwrotów i korekt faktur.
    label: 'Panel Obsługi Zwrotów i Reklamacji',
    iconId: 'refresh',
    route: 'producers3',
  },
  {
    // Punkt Sprzedaży (POS/Sales Desk): Uproszczony interfejs do szybkiego wprowadzania zamówień telefonicznych lub stacjonarnych.
    label: 'Punkt Sprzedaży',
    iconId: 'print',
    route: 'models3',
  },
  {
    // Zestawienia sprzedaży, marżowości oraz integracja z systemami płatności (Stripe/PayU).
    label: 'Raporty i Rozliczenia Finansowe',
    iconId: 'money-bill',
    route: 'categories3',
  },
  {
    // (CRM Light): Historia zakupowa, segmentacja (RFM) i zarządzanie rabatami indywidualnymi.
    label: 'Baza Klientów',
    iconId: 'users',
    route: 'categories3',
  },
];
