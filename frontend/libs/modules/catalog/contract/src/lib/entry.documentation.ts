import { ERP_PERMISSIONS } from '@erp/shared/auth';
import { ErpRemoteDocumentationDescriptor } from '@erp/shared/util';

export const remoteDocumentation: ErpRemoteDocumentationDescriptor = {
  moduleId: 'catalog',
  routePrefix: 'catalog',
  overviewArticleId: 'catalog.overview',
  requiredPermission: ERP_PERMISSIONS.Catalog.ProductRead,
  loadIndex: (locale) => import('@erp/catalog/feature').then((module) => module.loadDocumentationIndex(locale)),
};
