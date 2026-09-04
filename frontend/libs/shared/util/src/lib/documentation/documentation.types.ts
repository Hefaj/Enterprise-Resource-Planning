export const ERP_DOCUMENTATION_LOCALES = ['pl-PL', 'en-US'] as const;

export type ErpDocumentationLocale = (typeof ERP_DOCUMENTATION_LOCALES)[number];

export interface ErpDocumentationModuleDescriptor {
  readonly moduleId: string;
  readonly routePrefix: string;
  readonly overviewArticleId: string;
  readonly requiredPermission?: string;
}

export interface ErpDocumentationArticleDescriptor {
  readonly id: string;
  readonly slug: string;
  readonly parentId?: string;
  readonly order: number;
  readonly icon?: string;
  readonly relatedArticleIds?: readonly string[];
  readonly contextRoutes?: readonly string[];
  readonly capabilityIds?: readonly string[];
  readonly requiredPermission?: string;
}

export interface ErpDocumentationHeading {
  readonly id: string;
  readonly text: string;
  readonly level: 2 | 3;
}

export interface ErpDocumentationArticle {
  readonly id: string;
  readonly slug: string;
  readonly locale: ErpDocumentationLocale;
  readonly title: string;
  readonly summary: string;
  readonly html: string;
  readonly headings: readonly ErpDocumentationHeading[];
  readonly relatedArticleIds: readonly string[];
  readonly previousArticleId?: string;
  readonly nextArticleId?: string;
}

export interface ErpDocumentationNavigationItem {
  readonly articleId: string;
  readonly slug: string;
  readonly title: string;
  readonly order: number;
  readonly icon?: string;
  readonly children: readonly ErpDocumentationNavigationItem[];
}

export interface ErpDocumentationGeneratedModule {
  readonly module: ErpDocumentationModuleDescriptor;
  readonly locale: ErpDocumentationLocale;
  readonly articles: Readonly<Record<string, ErpDocumentationArticle>>;
  readonly articleIdBySlug: Readonly<Record<string, string>>;
  readonly navigation: readonly ErpDocumentationNavigationItem[];
  readonly contextArticleIds: Readonly<Record<string, string>>;
}

export interface ErpDocumentationSearchEntry {
  readonly moduleId: string;
  readonly articleId: string;
  readonly slug: string;
  readonly locale: ErpDocumentationLocale;
  readonly title: string;
  readonly summary: string;
  readonly headings: readonly string[];
  readonly normalizedText: string;
}

export interface ErpRemoteDocumentationDescriptor extends ErpDocumentationModuleDescriptor {
  readonly loadIndex: (
    locale: ErpDocumentationLocale,
  ) => Promise<readonly ErpDocumentationSearchEntry[]>;
}

export interface ErpDocumentationSearchResult extends ErpDocumentationSearchEntry {
  readonly score: number;
  readonly route: readonly string[];
}
