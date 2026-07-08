import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockDocument } from './document-list.component';

@Component({
  selector: 'erp-document-history',
  standalone: true,
  imports: [CommonModule],
  template: `
    @let doc = document();
    @if (doc) {
      <div class="document-detail-container">
        <h2 class="doc-title">{{ doc.title }} - Historia</h2>
        <hr class="divider" />
        <div class="content-section">
          <p class="content-text">Tymczasowa historia dla dokumentu o ID: {{ doc.id }}.</p>
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
    .divider {
      border: 0;
      border-top: 1px solid var(--tui-border-normal);
      margin-bottom: 1.5rem;
    }
    .content-text {
      color: var(--tui-text-primary);
      line-height: 1.6;
      font-size: 1rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentHistoryComponent {
  readonly document = input.required<MockDocument>();
}
