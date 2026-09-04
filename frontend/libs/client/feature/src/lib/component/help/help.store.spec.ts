import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ErpDocumentationRegistryService,
  ErpDocumentationIndexLoadResult,
  ErpDocumentationSearchResponse,
  ErpDocumentationSearchService,
  ErpLanguageService,
} from '@erp/shared/data-access';
import { ErpRemoteDocumentationDescriptor } from '@erp/shared/util';
import { HelpStore } from './help.store';

const catalog: ErpRemoteDocumentationDescriptor = {
  moduleId: 'catalog',
  routePrefix: 'catalog',
  overviewArticleId: 'catalog.overview',
  loadIndex: async () => [],
};

const tasks: ErpRemoteDocumentationDescriptor = {
  moduleId: 'task-management',
  routePrefix: 'task-management',
  overviewArticleId: 'task-management.overview',
  loadIndex: async () => [],
};

describe('HelpStore', () => {
  const modules = signal<readonly ErpRemoteDocumentationDescriptor[]>([catalog, tasks]);
  const language = signal<'pl-PL' | 'en-US'>('pl-PL');
  const search = vi.fn<(
    query: string,
    locale: 'pl-PL' | 'en-US',
  ) => Promise<ErpDocumentationSearchResponse>>();
  const loadIndex = vi.fn<(descriptor: ErpRemoteDocumentationDescriptor) => Promise<ErpDocumentationIndexLoadResult>>(
    async (descriptor) => ({ module: descriptor, entries: [] }),
  );

  beforeEach(() => {
    vi.useFakeTimers();
    search.mockReset();
    loadIndex.mockClear();
    modules.set([catalog, tasks]);
    language.set('pl-PL');
    TestBed.configureTestingModule({
      providers: [
        HelpStore,
        { provide: ErpDocumentationRegistryService, useValue: { modules, loadIndex } },
        { provide: ErpDocumentationSearchService, useValue: { search } },
        { provide: ErpLanguageService, useValue: { language } },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('does not load remote indexes for a one-character query', () => {
    const store = TestBed.inject(HelpStore);

    store.setQuery('p');

    expect(store.searchState()).toBe('idle');
    expect(search).not.toHaveBeenCalled();
  });

  it('keeps results usable when only one remote fails', async () => {
    search.mockResolvedValue({
      results: [],
      moduleErrors: [{ module: tasks, entries: [], error: new Error('offline') }],
    });
    const store = TestBed.inject(HelpStore);

    store.setQuery('produkt');
    await vi.advanceTimersByTimeAsync(250);

    expect(search).toHaveBeenCalledWith('produkt', 'pl-PL');
    expect(store.searchState()).toBe('ready');
  });

  it('shows an error when all active documentation remotes fail', async () => {
    search.mockResolvedValue({
      results: [],
      moduleErrors: [
        { module: catalog, entries: [], error: new Error('offline') },
        { module: tasks, entries: [], error: new Error('offline') },
      ],
    });
    const store = TestBed.inject(HelpStore);

    store.setQuery('produkt');
    await vi.advanceTimersByTimeAsync(250);

    expect(store.searchState()).toBe('error');
  });

  it('refreshes an active search after changing the interface language', async () => {
    search.mockResolvedValue({ results: [], moduleErrors: [] });
    const store = TestBed.inject(HelpStore);

    store.setQuery('produkt');
    await vi.advanceTimersByTimeAsync(250);
    language.set('en-US');
    TestBed.flushEffects();
    await vi.advanceTimersByTimeAsync(250);

    expect(search).toHaveBeenNthCalledWith(1, 'produkt', 'pl-PL');
    expect(search).toHaveBeenNthCalledWith(2, 'produkt', 'en-US');
  });
});
