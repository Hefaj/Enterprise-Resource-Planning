import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl } from '@angular/forms';

import {
  ErpButtonConfig,
  ErpConfirmDialogService,
  ErpGroupCardComponent,
  ErpGroupCardConfig,
  ErpInputBuilder,
  ErpInputConfig,
  ErpInputNumberBuilder,
  ErpInputNumberConfig,
  ErpInputPickerBuilder,
  ErpInputPickerConfig,
  ErpToastService,
  Translatable,
} from '@erp/shared/ui';
import { ERP_PERMISSIONS, PermissionStore } from '@erp/shared/auth';
import {
  IssueWorkLogService,
  TaskManagementIssueOrchestrator,
  TaskManagementWorkTypeOrchestrator,
  WorkTypeVM,
} from '@erp/task-management/data-access';
import { ErpWorkLogEntryRow, ErpWorkLogPanelComponent, ErpWorkLogPanelConfig } from '@erp/task-management/ui';

import { ISSUE_KEYS } from '../../translation';

/**
 * Sekcja czasu na karcie zgłoszenia (TIME-001/002) — adapter domenowy nad `erp-work-log-panel`
 * (task-management/ui, etap 3): dostarcza dane, komendy, kontrolki formularza i klucze
 * tłumaczeń, panel tylko renderuje.
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
  imports: [ErpGroupCardComponent, ErpWorkLogPanelComponent],
  template: `
    <erp-group-card [config]="this.cardConfig()">
      <erp-work-log-panel [config]="this.panelConfig()" />
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

  private readonly _entries = computed(() => this._workLogs.workLogsOf(this.issueUuid())());

  protected readonly entries = computed<ErpWorkLogEntryRow[]>(() =>
    this._entries().map((entry) => ({
      uuid: entry.uuid,
      loggedOn: entry.loggedOn,
      workTypeName: this.workTypeName(entry.workTypeUuid),
      minutes: entry.minutes,
      description: entry.description,
      isMine: entry.isMine,
    })),
  );

  protected readonly loggedMinutes = computed(() => this._entries().reduce((sum, entry) => sum + entry.minutes, 0));

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

  protected readonly cardConfig = computed<ErpGroupCardConfig>(() => ({
    title: { key: ISSUE_KEYS.detail.time.titleWithCount, params: { count: this.entries().length } },
    icon: '@tui.clock',
  }));

  // ── Estymata ──

  protected readonly editingEstimate = signal<boolean>(false);

  protected readonly estimateControl = new FormControl<number | null>(null);

  protected readonly estimateInputConfig: ErpInputNumberConfig = ErpInputNumberBuilder.create((b) =>
    b.setMode('integer').setMin(0).setPlaceholder(ISSUE_KEYS.detail.time.estimatePlaceholder),
  );

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

  protected readonly minutesInputConfig: ErpInputNumberConfig = ErpInputNumberBuilder.create((b) =>
    b.setMode('integer').setMin(1).setPlaceholder(ISSUE_KEYS.detail.time.minutesPlaceholder),
  );

  protected readonly descriptionInputConfig: ErpInputConfig = ErpInputBuilder.create((b) =>
    b.setType('text').setPlaceholder(ISSUE_KEYS.detail.time.descriptionPlaceholder),
  );

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
    appearance: 'flat',
    size: 'xs',
    iconStart: '@tui.plus',
    fn: (): Promise<void> => this.addWorkLogAsync(),
  };

  protected readonly panelConfig = computed<ErpWorkLogPanelConfig>(() => ({
    entries: this.entries(),
    loggedMinutes: this.loggedMinutes(),
    estimateMinutesOrNull: this.estimateMinutesOrNull(),
    remainingMinutes: this.remainingMinutes(),
    canEdit: this.canEdit(),
    editingEstimate: this.editingEstimate(),
    estimateLabel: ISSUE_KEYS.detail.time.estimateLabel,
    loggedLabel: ISSUE_KEYS.detail.time.loggedLabel,
    remainingLabel: ISSUE_KEYS.detail.time.remainingLabel,
    noEstimateLabel: ISSUE_KEYS.detail.time.noEstimate,
    noEntriesLabel: ISSUE_KEYS.detail.time.noEntries,
    formatMinutes: (minutes: number): Translatable => ({ key: ISSUE_KEYS.detail.time.minutesFormat, params: { minutes } }),
    estimateControl: this.estimateControl,
    estimateInputConfig: this.estimateInputConfig,
    editEstimateButton: this.editEstimateButton,
    saveEstimateButton: this.saveEstimateButton,
    cancelEstimateButton: this.cancelEstimateButton,
    onSaveEstimate: (): void => void this.saveEstimateAsync(),
    workTypeControl: this.workTypeControl,
    workTypePickerConfig: this.workTypePickerConfig(),
    minutesControl: this.minutesControl,
    minutesInputConfig: this.minutesInputConfig,
    descriptionControl: this.descriptionControl,
    descriptionInputConfig: this.descriptionInputConfig,
    addButton: this.addButton,
    onAddWorkLog: (): void => void this.addWorkLogAsync(),
    getRemoveButton: (entry: ErpWorkLogEntryRow): ErpButtonConfig => this.removeButton(entry.uuid),
  }));

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

  protected removeButton(workLogUuid: string): ErpButtonConfig {
    return {
      label: '',
      appearance: 'flat',
      size: 'xs',
      iconStart: '@tui.trash',
      fn: (): Promise<void> => this._removeWorkLogAsync(workLogUuid),
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
