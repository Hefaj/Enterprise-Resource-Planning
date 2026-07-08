import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiBadgedContent, TuiBadgeNotification } from '@taiga-ui/kit';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'erp-tasks',
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
    <tui-badged-content class="tasks-container">
      <button
        tuiIconButton
        type="button"
        appearance="flat"
        size="m"
        (click)="onTasksClick()"
        class="tasks-btn"
        title="Zadania"
      >
        <tui-icon icon="@tui.clipboard-list" />
      </button>

      <tui-badge-notification
        tuiSlot="top"
        size="s"
      >
        5
      </tui-badge-notification>
    </tui-badged-content>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
    .tasks-container {
      display: block;
    }
    .tasks-btn {
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
    .tasks-btn:hover {
      background: var(--tui-background-neutral-1-hover) !important;
    }
  `]
})
export class ErpTasksComponent {
  public readonly clickTasks = output<void>();

  protected onTasksClick(): void {
    this.clickTasks.emit();
  }
}
