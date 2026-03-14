import { ErpNavigationItem } from '@erp/shared/data-access';

export const remoteMenu: ErpNavigationItem[] = [
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
