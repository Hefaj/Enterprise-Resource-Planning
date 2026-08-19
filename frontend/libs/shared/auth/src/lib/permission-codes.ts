/**
 * Kopia katalogu kodów uprawnień z backendowego źródła prawdy —
 * `backend/building-blocks/Erp.BuildingBlocks.Contracts/Permissions.cs`. Front nie ma
 * dostępu do C#, więc kody trzeba zduplikować ręcznie; przy dopisywaniu nowego kodu po
 * stronie backendu dopisz go też tutaj (patrz docs/backend/identity-authz.md §3).
 */
export const ERP_PERMISSIONS = {
  Catalog: {
    ProductRead: 'catalog.product.read',
    ProductUpdate: 'catalog.product.update',
    ProductBulk: 'catalog.product.bulk',
    CategoryRead: 'catalog.category.read',
    CategoryUpdate: 'catalog.category.update',
    DictionaryRead: 'catalog.dictionary.read',
    JobControl: 'catalog.job.control',
  },
  Sales: {
    CustomerRead: 'sales.customer.read',
    CustomerUpdate: 'sales.customer.update',
    CustomerBulk: 'sales.customer.bulk',
  },
  Notification: {
    JobRead: 'notification.job.read',
    JobControl: 'notification.job.control',
  },
  Identity: {
    UserRead: 'identity.user.read',
    UserManage: 'identity.user.manage',
    RoleRead: 'identity.role.read',
    RoleManage: 'identity.role.manage',
    PermissionRead: 'identity.permission.read',
  },
} as const;
