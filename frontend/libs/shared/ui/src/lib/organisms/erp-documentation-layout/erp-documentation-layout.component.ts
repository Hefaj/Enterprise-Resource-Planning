import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { Translatable, unwrapSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpButtonBuilder, ErpButtonComponent } from '../../atoms/erp-button';
import { ErpDrawerBuilder, ErpDrawerComponent } from '../../atoms/erp-drawer';
import { ErpDocumentationArticleBuilder, ErpDocumentationArticleComponent } from '../../molecules/erp-documentation-article';
import { ErpDocumentationSearchComponent } from '../../molecules/erp-documentation-search';
import { ErpDocumentationNavigationComponent } from './erp-documentation-navigation.component';
import { ErpDocumentationLayoutConfig } from './erp-documentation-layout.types';

@Component({
  selector: 'erp-documentation-layout',
  standalone: true,
  imports: [
    ErpTranslatePipe,
    ErpButtonComponent,
    ErpDrawerComponent,
    ErpDocumentationArticleComponent,
    ErpDocumentationSearchComponent,
    ErpDocumentationNavigationComponent,
  ],
  template: `
    <a class="skip-link" href="#erp-documentation-content">{{ (_skipLinkLabel() | erpTranslate) || '' }}</a>
    <header class="header">
      <p class="module-title">{{ _moduleTitle() }}</p>
      <erp-documentation-search [config]="config().search" />
    </header>
    <div class="mobile-navigation">
      <erp-button [config]="mobileNavigationButtonConfig" />
    </div>
    <div class="layout">
      <nav class="topics" [attr.aria-label]="(_topicsLabel() | erpTranslate) || ''">
        <erp-documentation-navigation [config]="navigationConfig" />
      </nav>
      <main id="erp-documentation-content">
        <erp-documentation-article [config]="articleConfig()" />
      </main>
      <aside [attr.aria-label]="(_onThisPageLabel() | erpTranslate) || ''">
        <strong>{{ (_onThisPageLabel() | erpTranslate) || '' }}</strong>
        <ul>
          @for (heading of _article()?.headings ?? []; track heading.id) {
            <li [class.heading-child]="heading.level === 3">
              <button type="button" (click)="config().onHeadingSelect(heading.id)">{{ heading.text }}</button>
            </li>
          }
        </ul>
      </aside>
    </div>
    <erp-drawer [config]="mobileDrawerConfig" />
  `,
  styles: [`
    :host { display: block; height: 100%; overflow: auto; background: var(--tui-background-base); color: var(--tui-text-primary); }
    .skip-link { position: fixed; z-index: 50; top: .5rem; left: .5rem; transform: translateY(-200%); padding: .625rem .875rem; border-radius: .5rem; background: var(--tui-background-accent-1); color: var(--tui-text-primary-on-accent-1); }
    .skip-link:focus { transform: translateY(0); }
    .header { position: sticky; z-index: 10; top: 0; display: grid; grid-template-columns: minmax(14rem, 1fr) minmax(18rem, 34rem); gap: 2rem; align-items: end; padding: 1rem 2rem; border-bottom: 1px solid var(--tui-border-normal); background: var(--tui-background-base); }
    .module-title { margin: 0; font: var(--tui-font-heading-4); }
    .layout { display: grid; grid-template-columns: minmax(13rem, 18rem) minmax(0, 1fr) minmax(10rem, 15rem); gap: 2rem; max-width: 100rem; margin: 0 auto; padding: 2rem; }
    .topics, aside { position: sticky; top: 6.5rem; align-self: start; max-height: calc(100vh - 8rem); overflow: auto; }
    aside ul { margin: .5rem 0 0; padding: 0; list-style: none; }
    aside button { width: 100%; padding: .45rem .625rem; border: 0; border-radius: .5rem; background: transparent; color: var(--tui-text-secondary); text-align: left; cursor: pointer; }
    aside button:hover { background: var(--tui-background-neutral-1-hover); color: var(--tui-text-primary); }
    aside strong { font: var(--tui-font-text-m); }
    aside button { font: var(--tui-font-text-s); }
    aside .heading-child button { padding-left: 1.25rem; }
    .mobile-navigation { display: none; margin: 1rem; }
    @media (max-width: 70rem) { .layout { grid-template-columns: minmax(12rem, 16rem) minmax(0, 1fr); } aside { display: none; } }
    @media (max-width: 48rem) { .header { position: static; grid-template-columns: 1fr; gap: 1rem; padding: 1rem; } .layout { display: block; padding: 1rem; } .topics { display: none; } .mobile-navigation { display: block; } }
    @media (prefers-reduced-motion: reduce) { .skip-link { transition: none; } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpDocumentationLayoutComponent {
  public readonly config = input.required<ErpDocumentationLayoutConfig>();
  protected readonly mobileNavigationOpen = signal(false);
  protected readonly _moduleTitle = computed(() => unwrapSignal(this.config().moduleTitle) ?? '');
  protected readonly _article = computed(() => unwrapSignal(this.config().article) ?? null);
  protected readonly _navigation = computed(() => unwrapSignal(this.config().navigation) ?? []);
  protected readonly _activeArticleId = computed(() => unwrapSignal(this.config().activeArticleId) ?? null);
  protected readonly _skipLinkLabel = computed(() => unwrapSignal(this.config().skipLinkLabel));
  protected readonly _topicsLabel = computed(() => unwrapSignal(this.config().topicsLabel));
  protected readonly _onThisPageLabel = computed(() => unwrapSignal(this.config().onThisPageLabel));
  protected readonly _mobileNavigationLabel = computed<Translatable>(
    () => unwrapSignal(this.config().mobileNavigationLabel) ?? '',
  );
  protected readonly _closeMobileNavigationLabel = computed<Translatable>(
    () => unwrapSignal(this.config().closeMobileNavigationLabel) ?? '',
  );
  protected readonly articleConfig = computed(() => ErpDocumentationArticleBuilder.create((builder) => builder
    .setArticle(this._article)
    .setState(this.config().state)
    .setLoadingMessage(this.config().loadingMessage)
    .setErrorMessage(this.config().errorMessage)
    .setEmptyMessage(this.config().emptyMessage)
    .setPreviousLabel(this.config().previousLabel)
    .setNextLabel(this.config().nextLabel)
    .setOnArticleSelect(this.config().onArticleSelect)
    .setOnInternalLink(this.config().onInternalLink)));

  protected readonly navigationConfig = {
    items: this._navigation,
    activeArticleId: this._activeArticleId,
    onArticleSelect: (articleId: string): void => this.select(articleId),
  };

  protected readonly mobileNavigationButtonConfig = ErpButtonBuilder.create((builder) => builder
    .setLabel(this._mobileNavigationLabel)
    .setAppearance('outline')
    .setIconStart('@tui.menu')
    .setFn(() => this.mobileNavigationOpen.set(true)));

  protected readonly mobileDrawerConfig = ErpDrawerBuilder.create((builder) => builder
    .setOpen(this.mobileNavigationOpen)
    .setTitle(this._mobileNavigationLabel)
    .setCloseLabel(this._closeMobileNavigationLabel)
    .setOverlay(true)
    .setDirection('start')
    .setComponent(ErpDocumentationNavigationComponent, { config: this.navigationConfig })
    .setCloseOnNavigation(true)
    .setOnClose(() => this.mobileNavigationOpen.set(false)));

  protected select(articleId: string): void {
    this.mobileNavigationOpen.set(false);
    this.config().onArticleSelect(articleId);
  }
}
