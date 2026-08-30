import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { ErpButtonBuilder, ErpButtonComponent, ErpInputBuilder, ErpInputComponent, ErpInputNumberBuilder, ErpInputNumberComponent, ErpTranslatePipe } from '@erp/shared/ui';
import { TaskManagementClient, WorkLogDto } from '@erp/task-management/data-access';
import { ISSUE_KEYS } from '../../translation';

/** Rejestr pracy jest przy zgłoszeniu, nigdy przy tablicy — tablica może się zmienić, a wykonana praca nie. */
@Component({
  selector: 'erp-task-management-issue-work-log',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, ErpButtonComponent, ErpInputComponent, ErpInputNumberComponent, ErpTranslatePipe],
  template: `
    <section class="flex flex-col gap-3">
      <h2 class="m-0 text-sm font-semibold uppercase text-[var(--tui-text-secondary)]">{{ ISSUE_KEYS.detail.workLog.label | erpTranslate }}</h2>
      @if (items().length === 0) {
        <p class="m-0 text-sm text-[var(--tui-text-secondary)]">{{ ISSUE_KEYS.detail.workLog.empty | erpTranslate }}</p>
      }
      @for (item of items(); track item.uuid) {
        <div class="flex items-baseline justify-between gap-3 rounded border border-[var(--tui-border-normal)] p-3">
          <span
            >{{ item.minutes }} min
            @if (item.note) {
              — {{ item.note }}
            }
          </span>
          <span class="text-xs text-[var(--tui-text-secondary)]">{{ item.loggedAt | date: 'short' }}</span>
        </div>
      }
      @if (canWrite()) {
        <div class="flex flex-wrap items-end gap-2">
          <erp-input-number
            class="w-40"
            [config]="minutesInput"
            [control]="minutes"
          />
          <erp-input
            class="min-w-56 flex-1"
            [config]="noteInput"
            [control]="note"
          />
          <erp-button [config]="submitButton" />
        </div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueWorkLogComponent {
  protected readonly ISSUE_KEYS = ISSUE_KEYS;

  public readonly issueUuid = input.required<string>();
  public readonly canWrite = input(false);
  protected readonly items = signal<readonly WorkLogDto[]>([]);
  protected readonly minutes = new FormControl<number | null>(null);
  protected readonly note = new FormControl('', { nonNullable: true });
  private readonly _api = inject(TaskManagementClient);
  protected readonly minutesInput = ErpInputNumberBuilder.create((b) => b.setLabel(ISSUE_KEYS.detail.workLog.minutes).setMode('integer').setSign('positive').setMin(1).setMax(1440));
  protected readonly noteInput = ErpInputBuilder.create((b) => b.setLabel(ISSUE_KEYS.detail.workLog.note));
  protected readonly submitButton = ErpButtonBuilder.create((b) =>
    b
      .setLabel(ISSUE_KEYS.detail.workLog.submit)
      .setAppearance('primary')
      .setFn(() => this._submitAsync()),
  );

  public ngOnInit(): void {
    void this._loadAsync();
  }
  private async _loadAsync(): Promise<void> {
    this.items.set(await firstValueFrom(this._api.getIssueWorkLogs({ issueUuid: this.issueUuid() })));
  }
  private async _submitAsync(): Promise<void> {
    const minutes = this.minutes.value;
    if (!minutes || minutes < 1) return;
    await firstValueFrom(this._api.workLogCreateCommand({ issueUuid: this.issueUuid(), minutes, note: this.note.value, loggedAt: new Date() }));
    this.minutes.reset();
    this.note.setValue('');
    await this._loadAsync();
  }
}
