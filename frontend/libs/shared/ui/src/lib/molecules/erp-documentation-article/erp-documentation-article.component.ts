import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, input, ViewEncapsulation, viewChild } from '@angular/core';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpDocumentationArticleConfig } from './erp-documentation-article.types';

@Component({
  selector: 'erp-documentation-article',
  standalone: true,
  imports: [ErpTranslatePipe],
  template: `
    @if (_state() === 'loading') {
      <p class="empty" role="status">{{ (_loadingMessage() | erpTranslate) || '' }}</p>
    } @else if (_state() === 'error') {
      <p class="empty" role="alert">{{ (_errorMessage() | erpTranslate) || '' }}</p>
    } @else if (_article(); as article) {
      <article (click)="articleClicked($event)">
        <h1 #articleTitle tabindex="-1">{{ article.title }}</h1>
        <p class="summary">{{ article.summary }}</p>
        <div #articleContent class="content" [innerHTML]="article.html"></div>
        <nav class="pager" [attr.aria-label]="article.title">
          @if (article.previousArticleId) {
            <button type="button" (click)="selectArticle(article.previousArticleId)">← {{ (_previousLabel() | erpTranslate) || '' }}</button>
          }
          @if (article.nextArticleId) {
            <button type="button" class="pager__next" (click)="selectArticle(article.nextArticleId)">{{ (_nextLabel() | erpTranslate) || '' }} →</button>
          }
        </nav>
      </article>
    } @else {
      <p class="empty">{{ (_emptyMessage() | erpTranslate) || '' }}</p>
    }
  `,
  styles: [`
    erp-documentation-article { display: block; min-width: 0; }
    erp-documentation-article article { max-width: 80ch; margin: 0 auto; }
    erp-documentation-article h1 { margin: 0; color: var(--tui-text-primary); font-family: var(--tui-font-heading, inherit); font-size: 2rem; font-weight: 700; line-height: 1.2; }
    erp-documentation-article h1:focus { outline: none; }
    erp-documentation-article .summary { margin: .75rem 0 2rem; color: var(--tui-text-secondary); font-size: 1.125rem; line-height: 1.55; }
    erp-documentation-article .content { color: var(--tui-text-primary); line-height: 1.7; overflow-wrap: anywhere; }
    erp-documentation-article .content :is(h2, h3, h4) { scroll-margin-top: 5rem; }
    erp-documentation-article .content h2 { margin: 2.5rem 0 1rem; padding-top: 1.5rem; border-top: 1px solid var(--tui-border-normal); font-family: var(--tui-font-heading, inherit); font-size: 1.375rem; font-weight: 700; line-height: 1.3; }
    erp-documentation-article .content h2:first-child { margin-top: 0; padding-top: 0; border-top: none; }
    erp-documentation-article .content h3 { margin: 1.75rem 0 .625rem; font-family: var(--tui-font-heading, inherit); font-size: 1.125rem; font-weight: 700; line-height: 1.35; }
    erp-documentation-article .content :is(h4, h5, h6) { margin: 1.25rem 0 .5rem; font-size: 1rem; font-weight: 700; line-height: 1.4; }
    erp-documentation-article .content p { margin: 0 0 1rem; }
    erp-documentation-article .content :is(ul, ol) { margin: 0 0 1rem; padding-left: 1.5rem; }
    erp-documentation-article .content li { margin: .25rem 0; }
    erp-documentation-article .content li::marker { color: var(--tui-text-secondary); }
    erp-documentation-article .content blockquote { margin: 0 0 1rem; padding: .5rem 1rem; border-left: 3px solid var(--tui-border-normal); color: var(--tui-text-secondary); }
    erp-documentation-article .content strong { font-weight: 700; }
    erp-documentation-article .content hr { margin: 2rem 0; border: none; border-top: 1px solid var(--tui-border-normal); }
    erp-documentation-article .content :is(pre, table) { max-width: 100%; overflow-x: auto; }
    erp-documentation-article .content pre { padding: 1rem; border-radius: .75rem; background: var(--tui-background-neutral-1); }
    erp-documentation-article .content pre code { background: none; padding: 0; }
    erp-documentation-article .content code { padding: .125rem .375rem; border-radius: .375rem; background: var(--tui-background-neutral-1); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: .9em; }
    erp-documentation-article .content img { max-width: 100%; height: auto; border-radius: .75rem; }
    erp-documentation-article .content a { color: var(--tui-text-action); text-decoration: underline; text-decoration-thickness: 1.5px; text-underline-offset: .15em; font-weight: 500; }
    erp-documentation-article .content a:hover { text-decoration-thickness: 2px; }
    erp-documentation-article .content a:focus-visible { outline: .125rem solid var(--tui-border-focus); outline-offset: .125rem; border-radius: .125rem; }
    erp-documentation-article .pager { display: flex; gap: 1rem; margin-top: 3rem; padding-top: 1.25rem; border-top: 1px solid var(--tui-border-normal); }
    erp-documentation-article .pager button { padding: .625rem .875rem; border: 1px solid var(--tui-border-normal); border-radius: .625rem; background: var(--tui-background-base); color: var(--tui-text-action); cursor: pointer; }
    erp-documentation-article .pager__next { margin-left: auto; }
    erp-documentation-article .empty { padding: 3rem; color: var(--tui-text-secondary); text-align: center; }
    @media (prefers-reduced-motion: no-preference) { erp-documentation-article .content :is(h2, h3) { scroll-behavior: smooth; } }
  `],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpDocumentationArticleComponent {
  public readonly config = input.required<ErpDocumentationArticleConfig>();
  private readonly articleTitle = viewChild<ElementRef<HTMLHeadingElement>>('articleTitle');
  private readonly articleContent = viewChild<ElementRef<HTMLDivElement>>('articleContent');
  protected readonly _article = computed(() => unwrapSignal(this.config().article) ?? null);
  protected readonly _state = computed(() => unwrapSignal(this.config().state));
  protected readonly _loadingMessage = computed(() => unwrapSignal(this.config().loadingMessage));
  protected readonly _errorMessage = computed(() => unwrapSignal(this.config().errorMessage));
  protected readonly _emptyMessage = computed(() => unwrapSignal(this.config().emptyMessage));
  protected readonly _previousLabel = computed(() => unwrapSignal(this.config().previousLabel));
  protected readonly _nextLabel = computed(() => unwrapSignal(this.config().nextLabel));

  public constructor() {
    afterRenderEffect({ write: () => {
      const article = this._article();
      if (!article) return;

      const renderedHeadings = this.articleContent()?.nativeElement.querySelectorAll<HTMLHeadingElement>('h2, h3') ?? [];
      renderedHeadings.forEach((heading, index) => {
        const descriptor = article.headings[index];
        if (descriptor) heading.id = descriptor.id;
      });
      this.articleTitle()?.nativeElement.focus();
    } });
  }

  protected selectArticle(articleId: string): void { this.config().onArticleSelect(articleId); }
  protected articleClicked(event: MouseEvent): void {
    const anchor = (event.target as HTMLElement).closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href || /^(?:https?:|mailto:)/i.test(href)) return;
    event.preventDefault();
    this.config().onInternalLink(href);
  }
}
