import { ErpNavigationItem } from '@erp/shared/data-access';
import { JOBS_ROUTE } from '@erp/notification/util';

export const remoteMenu: ErpNavigationItem[] = [
  {
    label: 'Historia zadań',
    iconId: 'list-checks',
    route: JOBS_ROUTE,
  },
];
