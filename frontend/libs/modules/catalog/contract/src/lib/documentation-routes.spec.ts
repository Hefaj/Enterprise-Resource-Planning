import { Route } from '@angular/router';
import { CATALOG_DOCUMENTATION_ARTICLE_IDS } from '@erp/catalog/util';
import { remoteRoutes } from './entry.routes';

function flattenValues(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (!value || typeof value !== 'object') return [];
  return Object.values(value).flatMap(flattenValues);
}

function screenRoutes(routes: readonly Route[]): Route[] {
  return routes.flatMap((route) => {
    const current = route.loadComponent && !route.redirectTo && !route.path?.startsWith('documentation')
      ? [route]
      : [];
    return [...current, ...screenRoutes(route.children ?? [])];
  });
}

describe('Catalog contextual documentation routes', () => {
  it('maps every public screen to an existing article or an explicit exemption', () => {
    const articleIds = new Set(flattenValues(CATALOG_DOCUMENTATION_ARTICLE_IDS));

    for (const route of screenRoutes(remoteRoutes)) {
      const articleId = route.data?.['documentationArticleId'];
      const exemption = route.data?.['documentationExemptReason'];
      expect(
        articleIds.has(articleId) || (typeof exemption === 'string' && exemption.trim().length > 0),
        `Route "${route.path}" needs documentationArticleId or documentationExemptReason`,
      ).toBe(true);
    }
  });
});
