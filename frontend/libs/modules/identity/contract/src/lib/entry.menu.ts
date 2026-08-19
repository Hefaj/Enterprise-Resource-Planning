import { ErpNavigationItem } from '@erp/shared/data-access';
import { ERP_PERMISSIONS } from '@erp/shared/auth';

export const remoteMenu: ErpNavigationItem[] = [
  { label: 'Dashboard', iconId: 'home', route: 'dashboard' },
  {
    label: 'Historia nadań',
    iconId: 'history',
    route: 'grants',
    requiredPermission: ERP_PERMISSIONS.Identity.RoleManage,
  },
];
