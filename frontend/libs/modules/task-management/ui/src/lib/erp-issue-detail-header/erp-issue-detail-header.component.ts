import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ErpButtonComponent, ErpButtonConfig, ErpTranslatePipe } from '@erp/shared/ui';

import { ErpIssueKeyComponent } from '../erp-issue-key/erp-issue-key.component';
import { ErpIssueKeyConfig } from '../erp-issue-key/erp-issue-key.types';

/**
 * Wspólny, prezentacyjny pasek kontekstu karty zgłoszenia. Oddziela stałe elementy nagłówka
 * (powrót, klucz, ograniczenie i obserwowanie) od strony, która pozostaje właścicielem danych
 * oraz akcji. Dzięki temu kolejne widoki zgłoszenia nie powielą układu YouTrackowego nagłówka.
 */
@Component({
  selector: 'erp-issue-detail-header',
  standalone: true,
  imports: [ErpButtonComponent, ErpIssueKeyComponent, ErpTranslatePipe],
  template: `
    <div class="flex flex-wrap items-center gap-3">
      <erp-button [config]="this.backButton()" />
      <erp-issue-key [config]="this.issueKey()" />

      @if (this.restricted()) {
        <span class="rounded bg-[var(--tui-background-neutral-1)] px-2 py-0.5 text-xs">
          {{ this.restrictedLabelKey() | erpTranslate }}
        </span>
      }

      <span class="flex-1"></span>

      <erp-button [config]="this.watchButton()" />
      <span class="text-xs text-[var(--tui-text-secondary)]">
        {{ this.watcherCountLabelKey() | erpTranslate: { count: this.watcherCount() } }}
      </span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpIssueDetailHeaderComponent {
  public readonly backButton = input.required<ErpButtonConfig>();
  public readonly issueKey = input.required<ErpIssueKeyConfig>();
  public readonly restricted = input(false);
  public readonly restrictedLabelKey = input.required<string>();
  public readonly watchButton = input.required<ErpButtonConfig>();
  public readonly watcherCount = input(0);
  public readonly watcherCountLabelKey = input.required<string>();
}
