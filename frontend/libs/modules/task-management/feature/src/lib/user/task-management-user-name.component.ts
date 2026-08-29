import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { ERP_USER_DIRECTORY } from '@erp/shared/util';

/**
 * Nazwa użytkownika w widokach Task Management.
 *
 * Komponent jest smart celowo: moduł konsumujący jest właścicielem renderowanego widoku i sam
 * korzysta z portu katalogu. `shared/ui` pozostaje niezależne od domen użytkowników.
 */
@Component({
  selector: 'erp-task-management-user-name',
  standalone: true,
  template: `
    @let user = this.user();

    @if (user) {
      <span
        [class.erp-user-name--inactive]="!user.isActive"
        [attr.title]="user.email"
      >
        {{ user.displayName }}
      </span>
    } @else {
      <span
        class="erp-user-name--unresolved"
        [attr.title]="uuid()"
        >{{ placeholder() }}</span
      >
    }
  `,
  styles: [
    `
      :host {
        display: inline;
      }

      .erp-user-name--inactive {
        text-decoration: line-through;
        color: var(--tui-text-secondary);
      }

      .erp-user-name--unresolved {
        color: var(--tui-text-secondary);
        font-variant-numeric: tabular-nums;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskManagementUserNameComponent {
  public readonly uuid = input<string | null | undefined>(null);
  public readonly empty = input<string>('—');

  private readonly _directory = inject(ERP_USER_DIRECTORY, { optional: true });

  protected readonly user = computed(() => this._directory?.getOne(this.uuid())());

  protected readonly placeholder = computed(() => {
    const uuid = this.uuid();

    if (!uuid) {
      return this.empty();
    }

    return uuid.length > 8 ? `${uuid.slice(0, 8)}…` : uuid;
  });
}
