import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpTranslatePipe } from '@erp/shared/ui';
import { DOCUMENT_KEYS } from '../translation/keys';
import { MockDocument } from './document-list.component';

@Component({
  selector: 'erp-document-detail',
  standalone: true,
  imports: [CommonModule, ErpTranslatePipe],
  template: `
    @let doc = document();
    @if (doc) {
      <div class="document-detail-container">
        <h2 class="doc-title">{{ doc.title }}</h2>
        <div class="meta-info">
          <span>{{ { key: DOCUMENT_KEYS.base.detail.author, params: { author: doc.author } } | erpTranslate }}</span>
          <span class="separator">|</span>
          <span>{{ { key: DOCUMENT_KEYS.base.detail.createdAt, params: { date: doc.createdAt } } | erpTranslate }}</span>
        </div>
        <hr class="divider" />
        <div class="content-section">
          <h3>{{ DOCUMENT_KEYS.base.detail.content | erpTranslate }}</h3>
          <p class="content-text">{{ doc.content }}</p>
        </div>
      </div>
    }
  `,
  styles: [`
    .document-detail-container {
      padding: 2rem;
      background: var(--tui-background-neutral-1);
      border-radius: var(--tui-radius-l);
      margin: 1rem;
      border: 1px solid var(--tui-border-light);
    }
    .doc-title {
      margin-top: 0;
      color: var(--tui-text-primary);
      font-size: 1.5rem;
    }
    .meta-info {
      color: var(--tui-text-secondary);
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
      display: flex;
      gap: 0.5rem;
    }
    .separator {
      color: var(--tui-border-normal);
    }
    .divider {
      border: 0;
      border-top: 1px solid var(--tui-border-normal);
      margin-bottom: 1.5rem;
    }
    .content-section h3 {
      font-size: 1.1rem;
      color: var(--tui-text-primary);
      margin-bottom: 0.5rem;
    }
    .content-text {
      color: var(--tui-text-primary);
      line-height: 1.6;
      font-size: 1rem;
      white-space: pre-wrap;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentDetailComponent {
  readonly document = input.required<MockDocument>();
  protected readonly DOCUMENT_KEYS = DOCUMENT_KEYS;
}
