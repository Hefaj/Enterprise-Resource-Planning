import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiBadgedContent, TuiBadgeNotification } from '@taiga-ui/kit';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'erp-notifications',
  standalone: true,
  imports: [
    CommonModule,
    TuiButton,
    TuiIcon,
    TuiBadgedContent,
    TuiBadgeNotification
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tui-badged-content class="notifications-container">
      <button
        tuiIconButton
        type="button"
        appearance="flat"
        size="m"
        (click)="onNotificationClick()"
        class="notifications-btn"
        title="Powiadomienia"
      >
        <tui-icon icon="@tui.bell" />
      </button>

      <tui-badge-notification
        tuiSlot="top"
        size="s"
      >
        3
      </tui-badge-notification>
    </tui-badged-content>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
    .notifications-container {
      display: block;
    }
    .notifications-btn {
      position: relative;
      cursor: pointer;
      border-radius: var(--tui-radius-m) !important;
      border: 1px solid var(--tui-border-normal) !important;
      background: var(--tui-background-neutral-1) !important;
      color: var(--tui-text-primary) !important;
      width: 2.5rem !important;
      height: 2.5rem !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transition: all 0.2s;
    }
    .notifications-btn:hover {
      background: var(--tui-background-neutral-1-hover) !important;
    }
  `]
})
export class ErpNotificationsComponent {
  public readonly clickNotifications = output<void>();

  protected onNotificationClick(): void {
    this.clickNotifications.emit();
  }
}
