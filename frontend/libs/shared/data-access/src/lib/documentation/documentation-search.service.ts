import { inject, Injectable } from '@angular/core';
import {
  ErpDocumentationLocale,
  ErpDocumentationSearchEntry,
  ErpDocumentationSearchResult,
  erpNormalizeDocumentationText,
} from '@erp/shared/util';
import { ErpDocumentationIndexLoadResult, ErpDocumentationRegistryService } from './documentation-registry.service';

export interface ErpDocumentationSearchResponse {
  readonly results: readonly ErpDocumentationSearchResult[];
  readonly moduleErrors: readonly ErpDocumentationIndexLoadResult[];
}

@Injectable({ providedIn: 'root' })
export class ErpDocumentationSearchService {
  private readonly _registry = inject(ErpDocumentationRegistryService);

  public async search(query: string, locale: ErpDocumentationLocale, limitPerModule = 8): Promise<ErpDocumentationSearchResponse> {
    const normalizedQuery = erpNormalizeDocumentationText(query);
    if (normalizedQuery.length < 2) return { results: [], moduleErrors: [] };

    const words = normalizedQuery.split(' ');
    const loaded = await Promise.all(this._registry.modules().map((module) => this._registry.loadIndex(module, locale)));
    const moduleErrors = loaded.filter((result) => result.error !== undefined);
    const results = loaded.flatMap((moduleResult) => moduleResult.entries
      .map((entry) => ({
        ...entry,
        score: this._score(entry, normalizedQuery, words),
        route: [`/${moduleResult.module.routePrefix}`, 'documentation', entry.slug],
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
      .slice(0, limitPerModule));

    return { results, moduleErrors };
  }

  private _score(entry: ErpDocumentationSearchEntry, query: string, words: readonly string[]): number {
    const title = erpNormalizeDocumentationText(entry.title);
    const summary = erpNormalizeDocumentationText(entry.summary);
    const headings = erpNormalizeDocumentationText(entry.headings.join(' '));
    let score = title.includes(query) ? 24 : 0;
    if (headings.includes(query)) score += 12;
    if (summary.includes(query)) score += 8;
    for (const word of words) {
      if (title.includes(word)) score += 6;
      if (headings.includes(word)) score += 4;
      if (summary.includes(word)) score += 3;
      if (entry.normalizedText.includes(word)) score += 1;
    }
    return score;
  }
}
