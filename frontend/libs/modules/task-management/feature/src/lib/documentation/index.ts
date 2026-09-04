import { ErpDocumentationLocale, ErpDocumentationSearchEntry } from '@erp/shared/util';

export * from './page/documentation.component';

export function loadDocumentationIndex(locale: ErpDocumentationLocale): Promise<readonly ErpDocumentationSearchEntry[]> {
  return locale === 'en-US'
    ? import('./generated/documentation-search.en-US.generated').then((module) => module.DOCUMENTATION_SEARCH_EN_US)
    : import('./generated/documentation-search.pl-PL.generated').then((module) => module.DOCUMENTATION_SEARCH_PL_PL);
}
