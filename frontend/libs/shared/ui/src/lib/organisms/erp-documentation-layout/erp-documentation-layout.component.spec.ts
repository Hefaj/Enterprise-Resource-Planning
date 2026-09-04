import { TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { provideTaiga } from '@taiga-ui/core';
import { ErpDocumentationArticle, ErpDocumentationNavigationItem } from '@erp/shared/util';
import { TranslocoInlineLoader } from '../../translation';
import { ErpDocumentationSearchBuilder } from '../../molecules/erp-documentation-search';
import { ErpDocumentationLayoutBuilder } from './erp-documentation-layout.builder';
import { ErpDocumentationLayoutComponent } from './erp-documentation-layout.component';

const article: ErpDocumentationArticle = {
  id: 'sample.child',
  slug: 'child',
  locale: 'pl-PL',
  title: 'Artykuł',
  summary: 'Podsumowanie',
  html: '<h2>Sekcja</h2><p><a href="#sekcja">Przejdź do sekcji</a></p>',
  headings: [{ id: 'sekcja', text: 'Sekcja', level: 2 }],
  relatedArticleIds: [],
};

const navigation: readonly ErpDocumentationNavigationItem[] = [{
  articleId: 'sample.overview',
  slug: 'overview',
  title: 'Przegląd',
  order: 0,
  children: [{ articleId: article.id, slug: article.slug, title: article.title, order: 1, children: [] }],
}];

function layoutConfig(
  state: 'loading' | 'ready' | 'empty' | 'error' = 'ready',
  onInternalLink: (url: string) => void = () => undefined,
) {
  const search = ErpDocumentationSearchBuilder.create((builder) => builder
    .setQuery('')
    .setLabel('Szukaj')
    .setPlaceholder('Fraza')
    .setResults([])
    .setState('idle')
    .setNoResultsMessage('Brak wyników')
    .setErrorMessage('Błąd')
    .setOnQueryChange(() => undefined)
    .setOnResultSelect(() => undefined));

  return ErpDocumentationLayoutBuilder.create((builder) => builder
    .setModuleTitle('Moduł')
    .setArticle(state === 'ready' ? article : null)
    .setState(state)
    .setNavigation(navigation)
    .setActiveArticleId(article.id)
    .setSearch(search)
    .setSkipLinkLabel('Przejdź do treści')
    .setTopicsLabel('Tematy')
    .setOnThisPageLabel('Na tej stronie')
    .setMobileNavigationLabel('Pokaż tematy')
    .setCloseMobileNavigationLabel('Zamknij tematy')
    .setLoadingMessage('Ładowanie')
    .setErrorMessage('Błąd')
    .setEmptyMessage('Brak artykułu')
    .setPreviousLabel('Poprzedni')
    .setNextLabel('Następny')
    .setOnArticleSelect(() => undefined)
    .setOnInternalLink(onInternalLink)
    .setOnHeadingSelect(() => undefined));
}

describe('ErpDocumentationLayoutComponent', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
    TestBed.configureTestingModule({
      imports: [ErpDocumentationLayoutComponent],
      providers: [
        provideTaiga(),
        provideTransloco({
          config: { availableLangs: ['pl-PL'], defaultLang: 'pl-PL', reRenderOnLangChange: true },
          loader: TranslocoInlineLoader,
        }),
      ],
    });
  });

  it('renders nested navigation and marks the active article', async () => {
    const fixture = TestBed.createComponent(ErpDocumentationLayoutComponent);
    fixture.componentRef.setInput('config', layoutConfig());
    fixture.detectChanges();
    await fixture.whenStable();

    const active = fixture.nativeElement.querySelector('[aria-current="page"]') as HTMLButtonElement;
    expect(active.textContent).toContain('Artykuł');
    expect(fixture.nativeElement.querySelectorAll('.topic-list--nested').length).toBeGreaterThan(0);
    expect(fixture.nativeElement.querySelectorAll('main').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('article').length).toBe(1);
    expect(fixture.nativeElement.querySelector('#sekcja')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('erp-drawer')).not.toBeNull();
  });

  it.each([
    ['loading', 'status'],
    ['error', 'alert'],
    ['empty', null],
  ] as const)('renders the %s state', async (state, role) => {
    const fixture = TestBed.createComponent(ErpDocumentationLayoutComponent);
    fixture.componentRef.setInput('config', layoutConfig(state));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('article')).toBeNull();
    if (role) expect(fixture.nativeElement.querySelector(`[role="${role}"]`)).not.toBeNull();
  });

  it('passes a local heading link to the smart page without losing its fragment', async () => {
    const onInternalLink = vi.fn();
    const fixture = TestBed.createComponent(ErpDocumentationLayoutComponent);
    fixture.componentRef.setInput('config', layoutConfig('ready', onInternalLink));
    fixture.detectChanges();
    await fixture.whenStable();

    (fixture.nativeElement.querySelector('.content a') as HTMLAnchorElement).click();

    expect(onInternalLink).toHaveBeenCalledWith('#sekcja');
  });

  it('does not declare a component-level Transloco provider', () => {
    expect((ErpDocumentationLayoutComponent as unknown as { ɵcmp: { providers?: unknown } }).ɵcmp.providers).toBeUndefined();
  });
});
