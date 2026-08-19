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
  {
    label: 'Użytkownicy',
    iconId: 'users',
    route: 'users',
    requiredPermission: ERP_PERMISSIONS.Identity.UserRead,
  },
  {
    label: 'Role',
    iconId: 'shield',
    route: 'roles',
    requiredPermission: ERP_PERMISSIONS.Identity.RoleRead,
  },
  {
    label: 'Uprawnienia',
    iconId: 'key',
    route: 'permissions',
    requiredPermission: ERP_PERMISSIONS.Identity.PermissionRead,
  },
];
