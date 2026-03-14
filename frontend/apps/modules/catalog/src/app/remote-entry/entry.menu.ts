import { NavigationItem } from '@erp/shared/data-access-navigation';

export const remoteMenu: NavigationItem[] = [
  {
    label: 'Produkty',
    iconId: 'box',
    route: 'products',
  },
  {
    label: 'Producenci',
    iconId: 'crown',
    route: 'producers',
  },
  {
    label: 'Modele',
    iconId: 'at',
    route: 'models',
  },
  {
    label: 'Kategorie',
    iconId: 'asterisk',
    route: 'categories',
  },
];
