import { ErpNavigationItem } from '@erp/shared/data-access';

export const remoteMenu: ErpNavigationItem[] = [
  {
    label: 'Dashboard Analityczny Dokumentów',
    iconId: 'chart-bar',
    route: 'document',
  },
  {
    label: 'Archiwum Dokumentów',
    iconId: 'folder',
    children: [
      {
        label: 'Faktury',
        iconId: 'file-text',
        route: 'document/invoices',
      },
      {
        label: 'Umowy',
        iconId: 'file-text',
        route: 'document/contracts',
      },
      {
        label: 'Raporty i Analizy',
        iconId: 'folder',
        children: [
          {
            label: 'Kwartalne qweqwewqeqwe qweqweqweqwaxf fasfas',
            iconId: 'chart-line',
            route: 'document/reports/quarterly',
          },
          {
            label: 'Roczne',
            iconId: 'chart-line',
            route: 'document/reports/annual',
          }
        ]
      }
    ]
  },
  {
    label: 'Ustawienia DMS',
    iconId: 'settings',
    children: [
      {
        label: 'Typy Dokumentów',
        iconId: 'file',
        route: 'document/settings/types',
      },
      {
        label: 'Uprawnienia i Role',
        iconId: 'shield',
        route: 'document/settings/permissions',
      }
    ]
  }
];
