import { ERP_PERMISSIONS } from '@erp/shared/auth';
import { ErpRemoteDocumentationDescriptor } from '@erp/shared/util';

export const remoteDocumentation: ErpRemoteDocumentationDescriptor = {
  moduleId: 'task-management',
  routePrefix: 'task-management',
  overviewArticleId: 'task-management.overview',
  requiredPermission: ERP_PERMISSIONS.TaskManagement.IssueRead,
  loadIndex: (locale) => import('@erp/task-management/feature').then((module) => module.loadDocumentationIndex(locale)),
};
