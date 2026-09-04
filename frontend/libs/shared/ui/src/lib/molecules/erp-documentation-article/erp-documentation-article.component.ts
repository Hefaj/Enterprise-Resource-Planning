import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, input, viewChild } from '@angular/core';
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
    :host { display: block; min-width: 0; }
    article { max-width: 80ch; margin: 0 auto; }
    h1 { margin: 0; color: var(--tui-text-primary); font: var(--tui-font-heading-3); }
    h1:focus { outline: none; }
    .summary { margin: .75rem 0 2rem; color: var(--tui-text-secondary); font: var(--tui-font-text-l); line-height: 1.55; }
    .content { color: var(--tui-text-primary); line-height: 1.7; overflow-wrap: anywhere; }
    .content :is(h2, h3, h4) { scroll-margin-top: 5rem; }
    .content h2 { margin: 2.5rem 0 1rem; padding-top: 1.5rem; border-top: 1px solid var(--tui-border-normal); font: var(--tui-font-heading-5); }
    .content h2:first-child { margin-top: 0; padding-top: 0; border-top: none; }
    .content h3 { margin: 1.75rem 0 .625rem; font: var(--tui-font-heading-6); }
    .content h4, .content h5, .content h6 { margin: 1.25rem 0 .5rem; font: var(--tui-font-text-l); font-weight: 700; }
    .content p { margin: 0 0 1rem; }
    .content :is(ul, ol) { margin: 0 0 1rem; padding-left: 1.5rem; }
    .content li { margin: .25rem 0; }
    .content li::marker { color: var(--tui-text-secondary); }
    .content blockquote { margin: 0 0 1rem; padding: .5rem 1rem; border-left: 3px solid var(--tui-border-normal); color: var(--tui-text-secondary); }
    .content strong { font-weight: 700; }
    .content hr { margin: 2rem 0; border: none; border-top: 1px solid var(--tui-border-normal); }
    .content :is(pre, table) { max-width: 100%; overflow-x: auto; }
    .content pre { padding: 1rem; border-radius: .75rem; background: var(--tui-background-neutral-1); }
    .content pre code { background: none; padding: 0; }
    .content code { padding: .125rem .375rem; border-radius: .375rem; background: var(--tui-background-neutral-1); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: .9em; }
    .content img { max-width: 100%; height: auto; border-radius: .75rem; }
    .content a { color: var(--tui-text-action); text-decoration: underline; text-underline-offset: .15em; font-weight: 500; }
    .content a:hover { text-decoration-thickness: 2px; }
    .pager { display: flex; gap: 1rem; margin-top: 3rem; padding-top: 1.25rem; border-top: 1px solid var(--tui-border-normal); }
    .pager button { padding: .625rem .875rem; border: 1px solid var(--tui-border-normal); border-radius: .625rem; background: var(--tui-background-base); color: var(--tui-text-action); cursor: pointer; }
    .pager__next { margin-left: auto; }
    .empty { padding: 3rem; color: var(--tui-text-secondary); text-align: center; }
    @media (prefers-reduced-motion: no-preference) { .content :is(h2, h3) { scroll-behavior: smooth; } }
  `],
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
