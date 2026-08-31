import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiIcon } from '@taiga-ui/core';

import { unwrapSignal } from '@erp/shared/ui';

import { ErpIssueKeyConfig } from './erp-issue-key.types';

/**
 * Klucz zgłoszenia + ikona typu (`docs/frontend/task-management-pages.md` §10).
 *
 * Czysto prezentacyjny — nie zna orkiestratora ani zgłoszenia jako całości, wyłącznie to,
 * co ma pokazać. Klikalny link (`routerLink`) dostaje z zewnątrz, żeby to samo miejsce dało się
 * użyć w tabeli (przejście na kartę), na karcie (nagłówek, bez linku — już tam jesteśmy)
 * i w powiązaniach (przejście na inne zgłoszenie).
 */
@Component({
  selector: 'erp-issue-key',
  standalone: true,
  imports: [RouterLink, TuiIcon],
  template: `
    @if (this.link(); as link) {
      <a class="erp-issue-key" [routerLink]="link" [title]="this.typeName()">
        @if (this.typeIcon(); as icon) {
          <tui-icon class="erp-issue-key__icon" [icon]="icon" />
        }
        <span class="erp-issue-key__text">{{ this.issueKey() }}</span>
      </a>
    } @else {
      <span class="erp-issue-key" [title]="this.typeName()">
        @if (this.typeIcon(); as icon) {
          <tui-icon class="erp-issue-key__icon" [icon]="icon" />
        }
        <span class="erp-issue-key__text">{{ this.issueKey() }}</span>
      </span>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }

      .erp-issue-key {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        font-family: var(--tui-font-mono, monospace);
        font-size: 0.75rem;
        color: var(--tui-text-secondary);
        text-decoration: none;
        white-space: nowrap;
      }

      a.erp-issue-key:hover {
        text-decoration: underline;
      }

      .erp-issue-key__icon {
        font-size: 0.875rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpIssueKeyComponent {
  public readonly config = input.required<ErpIssueKeyConfig>();

  protected readonly issueKey = computed(() => unwrapSignal(this.config().issueKey));
  protected readonly typeIcon = computed(() => unwrapSignal(this.config().typeIcon));
  protected readonly typeName = computed(() => unwrapSignal(this.config().typeName) ?? '');
  protected readonly link = computed(() => unwrapSignal(this.config().link));
}
