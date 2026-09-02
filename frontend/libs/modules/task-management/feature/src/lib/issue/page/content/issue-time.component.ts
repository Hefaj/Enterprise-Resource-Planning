import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import {
  ErpButtonComponent,
  ErpButtonConfig,
  ErpConfirmDialogService,
  ErpGroupCardComponent,
  ErpGroupCardConfig,
  ErpInputPickerBuilder,
  ErpInputPickerComponent,
  ErpInputPickerConfig,
  ErpToastService,
  ErpTranslatePipe,
} from '@erp/shared/ui';
import { ERP_PERMISSIONS, PermissionStore } from '@erp/shared/auth';
import {
  IssueWorkLogDto,
  IssueWorkLogService,
  TaskManagementIssueOrchestrator,
  TaskManagementWorkTypeOrchestrator,
  WorkTypeVM,
} from '@erp/task-management/data-access';

import { ISSUE_KEYS } from '../../translation';

/**
 * Sekcja czasu na karcie zgłoszenia (TIME-001/002).
 *
 * <p><b>Dodanie wpisu w dwóch krokach</b> (TIME-001 AC3): rodzaj pracy jest wstępnie wybrany
 * (pierwszy dostępny), więc zostaje wpisanie minut i zatwierdzenie — `Enter` w polu minut albo
 * przycisk. Rejestracja, której wypełnienie trwa dłużej niż chwilę, nie jest wypełniana i raport
 * z niej kłamie (uzasadnienie wymagania).</p>
 *
 * <p><b>System nie ostrzega o przekroczeniu estymaty</b> (TIME-002 AC1) — różnica jest tylko
 * liczbą do przeczytania, decyzję o tym, co z nią zrobić, podejmuje lider, nie system.</p>
 */
@Component({
  selector: 'erp-task-management-issue-time',
  standalone: true,
  imports: [
    DatePipe,
    ErpButtonComponent,
    ErpGroupCardComponent,
    ErpInputPickerComponent,
    ErpTranslatePipe,
    ReactiveFormsModule,
  ],
  template: `
    <erp-group-card [config]="this.cardConfig()">
      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span>
            {{ ISSUE_KEYS.detail.time.estimateLabel | erpTranslate }}:
            @if (editingEstimate()) {
              <input
                class="w-20 rounded border border-[var(--tui-border-normal)] bg-transparent px-2 py-0.5 text-sm"
                type="number"
                min="0"
                [formControl]="this.estimateControl"
                [placeholder]="this.ISSUE_KEYS.detail.time.estimatePlaceholder | erpTranslate"
                (keydown.enter)="this.saveEstimateAsync()"
              />
              <erp-button [config]="this.saveEstimateButton" />
              <erp-button [config]="this.cancelEstimateButton" />
            } @else {
              <strong>
                @if (this.estimateMinutesOrNull() !== null) {
                  {{ ISSUE_KEYS.detail.time.minutesFormat | erpTranslate: { minutes: this.estimateMinutesOrNull() } }}
                } @else {
                  {{ ISSUE_KEYS.detail.time.noEstimate | erpTranslate }}
                }
              </strong>
              @if (this.canEdit()) {
                <erp-button [config]="this.editEstimateButton" />
              }
            }
          </span>

          <span>
            {{ ISSUE_KEYS.detail.time.loggedLabel | erpTranslate }}:
            <strong>{{ ISSUE_KEYS.detail.time.minutesFormat | erpTranslate: { minutes: this.loggedMinutes() } }}</strong>
          </span>

          @if (this.remainingMinutes() !== null) {
            <span>
              {{ ISSUE_KEYS.detail.time.remainingLabel | erpTranslate }}:
              <strong>{{ ISSUE_KEYS.detail.time.minutesFormat | erpTranslate: { minutes: this.remainingMinutes() } }}</strong>
            </span>
          }
        </div>

        @if (this.entries().length > 0) {
          <ul class="m-0 flex flex-col gap-1 p-0 text-sm">
            @for (entry of this.entries(); track entry.uuid) {
              <li class="flex items-center gap-2">
                <span class="text-[var(--tui-text-secondary)]">{{ entry.loggedOn | date: 'yyyy-MM-dd' }}</span>
                <span>{{ this.workTypeName(entry.workTypeUuid) }}</span>
                <strong>{{ ISSUE_KEYS.detail.time.minutesFormat | erpTranslate: { minutes: entry.minutes } }}</strong>
                @if (entry.description) {
                  <span class="text-[var(--tui-text-secondary)]">— {{ entry.description }}</span>
                }
                @if (entry.isMine) {
                  <erp-button [config]="this.removeButton(entry)" />
                }
              </li>
            }
          </ul>
        } @else {
          <p class="m-0 text-[var(--tui-text-secondary)]">{{ ISSUE_KEYS.detail.time.noEntries | erpTranslate }}</p>
        }

        @if (this.canEdit()) {
          <div class="flex flex-wrap items-center gap-2">
            <erp-input-picker class="min-w-32" [config]="this.workTypePickerConfig()" [control]="this.workTypeControl" />
            <input
              class="w-24 rounded border border-[var(--tui-border-normal)] bg-transparent px-2 py-1 text-sm"
              type="number"
              min="1"
              [formControl]="this.minutesControl"
              [placeholder]="ISSUE_KEYS.detail.time.minutesPlaceholder | erpTranslate"
              (keydown.enter)="this.addWorkLogAsync()"
            />
            <input
              class="min-w-32 flex-1 rounded border border-[var(--tui-border-normal)] bg-transparent px-2 py-1 text-sm"
              type="text"
              [formControl]="this.descriptionControl"
              [placeholder]="ISSUE_KEYS.detail.time.descriptionPlaceholder | erpTranslate"
              (keydown.enter)="this.addWorkLogAsync()"
            />
            <erp-button [config]="this.addButton" />
          </div>
        }
      </div>
    </erp-group-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueTimeComponent {
  protected readonly ISSUE_KEYS = ISSUE_KEYS;

  private readonly _workLogs = inject(IssueWorkLogService);
  private readonly _workTypes = inject(TaskManagementWorkTypeOrchestrator);
  private readonly _issues = inject(TaskManagementIssueOrchestrator);
  private readonly _permissionStore = inject(PermissionStore);
  private readonly _confirm = inject(ErpConfirmDialogService);
  private readonly _toast = inject(ErpToastService);

  public readonly issueUuid = input.required<string>();

  public readonly projectUuid = input.required<string>();

  public readonly estimateMinutes = input<number | undefined>(undefined);

  protected readonly canEdit = computed(() => this._permissionStore.has(ERP_PERMISSIONS.TaskManagement.IssueUpdate));

  protected readonly entries = computed(() => this._workLogs.workLogsOf(this.issueUuid())());

  protected readonly loggedMinutes = computed(() => this.entries().reduce((sum, entry) => sum + entry.minutes, 0));

  /** `null` znaczy „brak estymaty" — odróżnione od `0`, które jest poprawną wartością. */
  protected readonly estimateMinutesOrNull = computed(() => this.estimateMinutes() ?? null);

  /** Różnica estymata − zalogowano; `null`, dopóki nie ma estymaty (TIME-002 AC1 — sama liczba,
   * bez ostrzeżenia o przekroczeniu).
   *
   * <p>Backend serializuje brak estymaty jako JSON `null`, nie pomija pola — porównanie musi
   * więc łapać OBIE wartości (`??`, nie `=== undefined`), inaczej `null - zalogowano` daje
   * fałszywe „pozostało: -45 min" zamiast schowanego wiersza (znalezione przy weryfikacji
   * na żywo).</p> */
  protected readonly remainingMinutes = computed(() => {
    const estimate = this.estimateMinutesOrNull();
    return estimate === null ? null : estimate - this.loggedMinutes();
  });

  private readonly _cardConfig = computed<ErpGroupCardConfig>(() => ({
    title: { key: ISSUE_KEYS.detail.time.titleWithCount, params: { count: this.entries().length } },
    icon: '@tui.clock',
  }));

  protected readonly cardConfig = this._cardConfig;

  // ── Estymata ──

  protected readonly editingEstimate = signal<boolean>(false);

  protected readonly estimateControl = new FormControl<number | null>(null);

  protected readonly editEstimateButton: ErpButtonConfig = {
    label: ISSUE_KEYS.detail.time.editEstimate,
    appearance: 'flat',
    size: 'xs',
    iconStart: '@tui.pencil',
    fn: (): void => {
      this.estimateControl.setValue(this.estimateMinutes() ?? null);
      this.editingEstimate.set(true);
    },
  };

  protected readonly saveEstimateButton: ErpButtonConfig = {
    label: ISSUE_KEYS.detail.description.save,
    appearance: 'primary',
    size: 'xs',
    fn: (): Promise<void> => this.saveEstimateAsync(),
  };

  protected readonly cancelEstimateButton: ErpButtonConfig = {
    label: ISSUE_KEYS.detail.description.cancel,
    appearance: 'flat',
    size: 'xs',
    fn: (): void => this.editingEstimate.set(false),
  };

  // ── Dodanie wpisu ──

  protected readonly workTypeControl = new FormControl<string | null>(null);

  protected readonly minutesControl = new FormControl<number | null>(null);

  protected readonly descriptionControl = new FormControl<string>('');

  protected readonly workTypePickerConfig = computed<ErpInputPickerConfig>(() =>
    ErpInputPickerBuilder.create((b) =>
      b
        .setLabel(ISSUE_KEYS.detail.time.workTypeLabel)
        .setItems([...this._workTypes.getViewModel()().values()])
        .setLabelKey('name')
        .setValueKey('uuid')
        .setStrategy('single'),
    ),
  );

  protected readonly addButton: ErpButtonConfig = {
    label: ISSUE_KEYS.detail.time.addButton,
    appearance: 'primary',
    size: 's',
    iconStart: '@tui.plus',
    fn: (): Promise<void> => this.addWorkLogAsync(),
  };

  public constructor() {
    effect(() => {
      const issueUuid = this.issueUuid();
      untracked(() => void this._workLogs.loadAsync(issueUuid));
    });

    effect(() => {
      const projectUuid = this.projectUuid();
      untracked(() => void this._loadWorkTypesAsync(projectUuid));
    });
  }

  protected workTypeName(workTypeUuid: string): string {
    return (this._workTypes.getViewModel()().get(workTypeUuid) as WorkTypeVM | undefined)?.name ?? workTypeUuid;
  }

  protected removeButton(entry: IssueWorkLogDto): ErpButtonConfig {
    return {
      label: '',
      appearance: 'flat',
      size: 'xs',
      iconStart: '@tui.trash',
      fn: (): Promise<void> => this._removeWorkLogAsync(entry.uuid),
    };
  }

  protected async saveEstimateAsync(): Promise<void> {
    const issueUuid = this.issueUuid();
    const value = this.estimateControl.value;

    this.editingEstimate.set(false);

    try {
      await this._issues.setEstimateAsync({ uuid: issueUuid, estimateMinutes: value ?? undefined });
    } catch (error) {
      console.error('[IssueTimeComponent] Nie udało się zapisać estymaty.', error);
      this._toast.show({ message: ISSUE_KEYS.detail.time.estimateSaveFailed, appearance: 'negative' });
    }
  }

  protected async addWorkLogAsync(): Promise<void> {
    const issueUuid = this.issueUuid();
    const workTypeUuid = this.workTypeControl.value ?? [...this._workTypes.getViewModel()().keys()][0];
    const minutes = this.minutesControl.value;

    if (!workTypeUuid || !minutes || minutes <= 0) {
      return;
    }

    const description = this.descriptionControl.value?.trim() || undefined;

    this.minutesControl.setValue(null);
    this.descriptionControl.setValue('');

    try {
      await this._issues.addWorkLogAsync({
        uuid: crypto.randomUUID(),
        issueUuid,
        workTypeUuid,
        // `loggedOn` jest `DateOnly` po stronie backendu — konwerter JSON w .NET akceptuje
        // WYŁĄCZNIE „yyyy-MM-dd", nie pełny znacznik czasu. `new Date(...)` serializowałby się
        // przez `toISOString()` do „…T00:00:00.000Z" i backend odrzuciłby to jako 400
        // (znalezione i naprawione przy weryfikacji na żywo — ten sam błąd naprawiono
        // w `sprint-create.step.ts`, patrz komentarz tam).
        loggedOn: new Date().toISOString().slice(0, 10) as unknown as Date,
        minutes,
        description,
      });
    } catch (error) {
      console.error('[IssueTimeComponent] Nie udało się dodać wpisu czasu.', error);
      this._toast.show({ message: ISSUE_KEYS.detail.time.addFailed, appearance: 'negative' });
    }
  }

  private async _removeWorkLogAsync(uuid: string): Promise<void> {
    const confirmed = await this._confirm.confirmAsync({
      title: ISSUE_KEYS.detail.time.removeConfirmTitle,
      message: ISSUE_KEYS.detail.time.removeConfirmMessage,
      confirmLabel: ISSUE_KEYS.detail.time.removeConfirmTitle,
      appearance: 'destructive',
    });

    if (!confirmed) {
      return;
    }

    try {
      await this._issues.removeWorkLogAsync({ uuid });
    } catch (error) {
      console.error('[IssueTimeComponent] Nie udało się usunąć wpisu czasu.', error);
      this._toast.show({ message: ISSUE_KEYS.detail.time.removeFailed, appearance: 'negative' });
    }
  }

  private async _loadWorkTypesAsync(projectUuid: string): Promise<void> {
    if (!projectUuid) {
      return;
    }

    try {
      const types = await this._workTypes.searchWorkTypesAsync({ projectUuid });

      if (!this.workTypeControl.value && types.length > 0) {
        this.workTypeControl.setValue(types[0].uuid);
      }
    } catch (error) {
      console.error('[IssueTimeComponent] Nie udało się pobrać rodzajów pracy.', error);
    }
  }
}
