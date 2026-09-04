/**
 * Kopia katalogu kodów uprawnień z backendowego źródła prawdy —
 * `backend/building-blocks/Erp.BuildingBlocks.Contracts/Permissions.cs`. Front nie ma
 * dostępu do C#, więc kody trzeba zduplikować ręcznie; przy dopisywaniu nowego kodu po
 * stronie backendu dopisz go też tutaj (patrz docs/architecture/security.md §3).
 */
export const ERP_PERMISSIONS = {
  Catalog: {
    ProductRead: 'catalog.product.read',
    ProductUpdate: 'catalog.product.update',
    ProductBulk: 'catalog.product.bulk',
    CategoryRead: 'catalog.category.read',
    CategoryUpdate: 'catalog.category.update',
    DictionaryRead: 'catalog.dictionary.read',
    MultimediaUpdate: 'catalog.multimedia.update',
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
    IntegrationClientManage: 'identity.integration_client.manage',
  },
  TaskManagement: {
    IssueRead: 'taskmgmt.issue.read',
    IssueCreate: 'taskmgmt.issue.create',
    IssueUpdate: 'taskmgmt.issue.update',
    IssueBulk: 'taskmgmt.issue.bulk',
    BoardManage: 'taskmgmt.board.manage',
    ProjectManage: 'taskmgmt.project.manage',
    SchemeManage: 'taskmgmt.scheme.manage',
    TagManage: 'taskmgmt.tag.manage',
    ReportReadAll: 'taskmgmt.report.read.all',
    AutomationManage: 'taskmgmt.automation.manage',
    WebhookManage: 'taskmgmt.webhook.manage',
  },
} as const;
