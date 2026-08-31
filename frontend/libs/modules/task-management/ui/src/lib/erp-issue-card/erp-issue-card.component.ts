import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ErpTranslatePipe, ErpUserNameComponent, unwrapSignal } from '@erp/shared/ui';
import { ISSUE_PRIORITY } from '@erp/task-management/util';

import { ErpIssueKeyComponent } from '../erp-issue-key';
import { ErpIssueCardConfig } from './erp-issue-card.types';

/**
 * Karta na tablicy — przeniesiona z `feature/board/components/board-card` (`NFR-009`).
 *
 * <p>Czysto prezentacyjna: nie zna orkiestratora, nie wysyła komend i nie wie, że jest
 * przeciągana — przeciąganie zostaje w `erp-board-column` (`feature`), bo to ona jest listą
 * `cdkDropList`.</p>
 */
@Component({
  selector: 'erp-issue-card',
  standalone: true,
  imports: [ErpIssueKeyComponent, ErpTranslatePipe, ErpUserNameComponent],
  template: `
    <div class="erp-issue-card">
      <div class="erp-issue-card__header">
        <erp-issue-key
          [config]="{
            issueKey: this.issueKey(),
            typeIcon: this.typeIcon(),
            typeName: this.typeName(),
            link: this.link(),
          }"
        />
        <span class="erp-issue-card__priority" [class]="this.priorityClass()">
          {{ this.priorityLabelKey() | erpTranslate }}
        </span>
      </div>

      <span class="erp-issue-card__title">{{ this.title() }}</span>

      <erp-user-name [uuid]="this.assigneeUuid()" [empty]="(this.assigneeEmptyLabel() ?? '') | erpTranslate" />
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .erp-issue-card {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        border-radius: 0.375rem;
        border: 1px solid var(--tui-border-normal);
        background: var(--tui-background-base);
        padding: 0.75rem;
      }

      .erp-issue-card__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }

      .erp-issue-card__priority {
        font-size: 0.75rem;
      }

      .erp-issue-card__title {
        font-size: 0.875rem;
        line-height: 1.3;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpIssueCardComponent {
  public readonly config = input.required<ErpIssueCardConfig>();

  protected readonly issueKey = computed(() => unwrapSignal(this.config().issueKey));
  protected readonly title = computed(() => unwrapSignal(this.config().title));
  protected readonly priority = computed(() => unwrapSignal(this.config().priority));
  protected readonly priorityLabelKey = computed(() => unwrapSignal(this.config().priorityLabelKey));
  protected readonly typeIcon = computed(() => unwrapSignal(this.config().typeIcon));
  protected readonly typeName = computed(() => unwrapSignal(this.config().typeName));
  protected readonly assigneeUuid = computed(() => unwrapSignal(this.config().assigneeUuid));
  protected readonly assigneeEmptyLabel = computed(() => unwrapSignal(this.config().assigneeEmptyLabel));
  protected readonly link = computed(() => unwrapSignal(this.config().link));

  protected readonly priorityClass = computed(() => {
    switch (this.priority()) {
      case ISSUE_PRIORITY.Critical:
      case ISSUE_PRIORITY.High:
        return 'text-[var(--tui-status-negative)]';
      case ISSUE_PRIORITY.Low:
      case ISSUE_PRIORITY.Lowest:
        return 'text-[var(--tui-text-tertiary)]';
      default:
        return 'text-[var(--tui-text-secondary)]';
    }
  });
}
