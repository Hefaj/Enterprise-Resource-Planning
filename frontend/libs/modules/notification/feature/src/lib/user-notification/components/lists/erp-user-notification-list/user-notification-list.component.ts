import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TuiButton } from '@taiga-ui/core';

import { UserNotificationService } from '@erp/shared/data-access';
import { ErpTranslatePipe } from '@erp/shared/ui';
import { UserNotificationDto, UserNotificationFeedService } from '@erp/notification/data-access';
import { JOB_KEYS } from '@erp/notification/ui';

/**
 * Zawartość panelu powiadomień (Faza 5, `UserNotification`) pod przyciskiem `erp-notifications`
 * w nagłówku — ładowana leniwie przez osobny widżet (`entry.widgets.ts`,
 * `loadUserNotificationListComponent()`), sąsiadka `erp-job-list` pod przyciskiem `erp-tasks`.
 *
 * <p>Klucz tytułu (`titleKey`) i parametry (`params`) przychodzą gotowe z backendu
 * (`IssueNotificationPublisher`), więc wiersz tylko je tłumaczy — front nie zna treści zdania,
 * tylko konwencję `shared.notifications.kinds.*` (`docs/backend/user-notifications.md` §3).</p>
 */
@Component({
  selector: 'erp-user-notification-list',
  standalone: true,
  imports: [DatePipe, RouterLink, TuiButton, ErpTranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col w-full" style="min-width: 22rem; max-width: 26rem;">
      @if (unreadCount() > 0) {
        <div class="flex justify-end px-3 py-1.5 flex-shrink-0">
          <button tuiButton type="button" appearance="flat" size="xs" (click)="markAllRead()">
            {{ keys.notifications.markAllRead | erpTranslate }}
          </button>
        </div>
      }

      @if (items().length === 0) {
        <p class="px-3 py-6 text-sm text-center flex-shrink-0" style="color: var(--tui-text-tertiary);">
          {{ keys.notifications.empty | erpTranslate }}
        </p>
      } @else {
        <div class="flex flex-col overflow-y-auto flex-shrink-0" style="max-height: 17rem;">
          @for (item of items(); track item.uuid) {
            <a
              [routerLink]="item.link"
              class="flex flex-col gap-0.5 px-3 py-2.5 no-underline"
              [style.background]="item.readAt ? 'transparent' : 'var(--tui-background-neutral-1)'"
              [style.color]="'var(--tui-text-primary)'"
              (click)="markRead(item)"
            >
              <span class="text-sm">
                {{ { key: item.titleKey, params: item.params } | erpTranslate }}
                @if (item.occurrenceCount > 1) {
                  <span style="color: var(--tui-text-tertiary);"> ×{{ item.occurrenceCount }}</span>
                }
              </span>
              <span class="text-xs" style="color: var(--tui-text-tertiary);">
                {{ item.lastOccurredAt | date: 'short' }}
              </span>
            </a>
          }
        </div>
      }
    </div>
  `,
})
export class UserNotificationListComponent implements OnInit {
  private readonly _feed = inject(UserNotificationFeedService);
  private readonly _unread = inject(UserNotificationService);

  protected readonly keys = JOB_KEYS;

  protected readonly items = this._feed.items;
  protected readonly unreadCount = computed(() => this._unread.unreadCount());

  public ngOnInit(): void {
    void this._feed.loadAsync();
  }

  protected markRead(item: UserNotificationDto): void {
    if (!item.readAt) {
      void this._feed.markReadAsync(item.uuid);
    }
  }

  protected markAllRead(): void {
    void this._feed.markAllReadAsync();
  }
}
