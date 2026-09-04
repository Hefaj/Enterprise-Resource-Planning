import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ErpDocumentationNavigationItem } from '@erp/shared/util';
import { MaybeSignal, unwrapSignal } from '../../base/erp-signal-utils';

export interface ErpDocumentationNavigationConfig {
  readonly items: MaybeSignal<readonly ErpDocumentationNavigationItem[]>;
  readonly activeArticleId: MaybeSignal<string | null>;
  readonly onArticleSelect: (articleId: string) => void;
}

@Component({
  selector: 'erp-documentation-navigation',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    <ng-container
      [ngTemplateOutlet]="navigation"
      [ngTemplateOutletContext]="{ items: _items(), level: 0 }"
    />

    <ng-template #navigation let-items="items" let-level="level">
      <ul class="topic-list" [class.topic-list--nested]="level > 0">
        @for (item of items; track item.articleId) {
          <li>
            <button
              type="button"
              [attr.aria-current]="_activeArticleId() === item.articleId ? 'page' : null"
              (click)="select(item.articleId)"
            >
              {{ item.title }}
            </button>
            @if (item.children.length > 0) {
              <ng-container
                [ngTemplateOutlet]="navigation"
                [ngTemplateOutletContext]="{ items: item.children, level: level + 1 }"
              />
            }
          </li>
        }
      </ul>
    </ng-template>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .topic-list { margin: .5rem 0 0; padding: 0; list-style: none; }
    .topic-list--nested { margin-left: .75rem; padding-left: .5rem; border-left: 1px solid var(--tui-border-normal); }
    button { width: 100%; padding: .45rem .625rem; border: 0; border-radius: .5rem; background: transparent; color: var(--tui-text-secondary); text-align: left; cursor: pointer; }
    button:hover { background: var(--tui-background-neutral-1-hover); color: var(--tui-text-primary); }
    button:focus-visible { outline: .125rem solid var(--tui-border-focus); outline-offset: .125rem; }
    button[aria-current='page'] { background: var(--tui-background-accent-1); color: var(--tui-text-primary-on-accent-1); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpDocumentationNavigationComponent {
  public readonly config = input.required<ErpDocumentationNavigationConfig>();
  protected readonly _items = computed(() => unwrapSignal(this.config().items) ?? []);
  protected readonly _activeArticleId = computed(() => unwrapSignal(this.config().activeArticleId) ?? null);

  protected select(articleId: string): void {
    this.config().onArticleSelect(articleId);
  }
}
