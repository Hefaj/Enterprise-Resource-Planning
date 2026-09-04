import { signal } from '@angular/core';
import { ErpDocumentationLayoutBuilder } from './erp-documentation-layout.builder';

describe('ErpDocumentationLayoutBuilder', () => {
  it('builds one reactive config for the documentation layout', () => {
    const activeArticleId = signal<string | null>('catalog.overview');
    const onArticleSelect = vi.fn();
    const config = ErpDocumentationLayoutBuilder.create((builder) => builder
      .setModuleTitle('Catalog')
      .setArticle(null)
      .setNavigation([])
      .setActiveArticleId(activeArticleId)
      .setSkipLinkLabel('shared.documentation.skipToContent')
      .setCloseMobileNavigationLabel('shared.documentation.closeMobileNavigation')
      .setOnArticleSelect(onArticleSelect));

    expect(config.moduleTitle).toBe('Catalog');
    expect(config.activeArticleId).toBe(activeArticleId);
    expect(config.closeMobileNavigationLabel).toBe('shared.documentation.closeMobileNavigation');
    config.onArticleSelect?.('catalog.products');
    expect(onArticleSelect).toHaveBeenCalledWith('catalog.products');
  });
});
