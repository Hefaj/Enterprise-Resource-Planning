import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  ErpButtonComponent,
  ErpButtonConfig,
  ErpInputBuilder,
  ErpInputComponent,
  ErpInputConfig,
  ErpInputPickerBuilder,
  ErpInputPickerComponent,
  ErpInputPickerConfig,
  ErpTranslatePipe,
} from '@erp/shared/ui';
import { JobService } from '@erp/shared/data-access';
import {
  erpAwaitJobAsync,
  IssueAddLinkCommand,
  IssueGraphService,
  IssueLinkDto,
  TaskManagementIssueOrchestrator,
} from '@erp/task-management/data-access';
import { ISSUE_LINK_TYPE } from '@erp/task-management/util';

import { ISSUE_KEYS } from '../../translation';

/**
 * Pasek powiązań na karcie zgłoszenia: rodzic, podzadania i graf powiązań
 * (`docs/frontend/task-management-pages.md` §2.3).
 *
 * <p><b>Ta sama krawędź ma dwie nazwy</b>, zależnie od strony: „blokuje" u źródła
 * i „blokowane przez" u celu. W bazie jest jednym wierszem, a rozstrzyga flaga `isOutgoing` —
 * bez niej front musiałby porównywać uuidy i zgadywać.</p>
 *
 * <p>Cel powiązania wskazuje się <b>kluczem czytelnym</b> (`DEV-412`), nie uuidem: to on krąży
 * w mailach i to jego użytkownik ma pod ręką. Zamianę na uuid robi front jednym zapytaniem
 * `getIssueByKey` — backend przyjmuje uuid, bo klucz jest zmienny przy przeniesieniu projektu
 * (§4).</p>
 */
@Component({
  selector: 'erp-task-management-issue-links',
  standalone: true,
  imports: [
    ErpButtonComponent,
    ErpInputComponent,
    ErpInputPickerComponent,
    ErpTranslatePipe,
    ReactiveFormsModule,
    RouterLink,
  ],
  template: `
    <section class="flex flex-col gap-3">
      <span class="text-xs uppercase tracking-wide text-[var(--tui-text-tertiary)]">
        {{ ISSUE_KEYS.detail.links.title | erpTranslate }}
      </span>

      @let graph = this.graph();

      @if (graph?.parent) {
        <div class="flex items-baseline gap-2 text-sm">
          <span class="text-[var(--tui-text-tertiary)]">{{ ISSUE_KEYS.detail.links.parent | erpTranslate }}</span>
          <a class="font-mono text-xs hover:underline" [routerLink]="['/task-management/issue', graph!.parent!.key]">
            {{ graph!.parent!.key }}
          </a>
          <span class="truncate">{{ graph!.parent!.title }}</span>
          <erp-button [config]="detachParentButton" />
        </div>
      } @else {
        <div class="flex items-end gap-2">
          <erp-input class="flex-1" [config]="parentInput" [formControl]="parentControl" />
          <erp-button [config]="setParentButton" />
        </div>
      }

      @if ((graph?.children?.length ?? 0) > 0) {
        <div class="flex flex-col gap-1">
          <span class="text-[var(--tui-text-tertiary)] text-sm">
            {{ ISSUE_KEYS.detail.links.children | erpTranslate }}
          </span>
          @for (child of graph!.children; track child.uuid) {
            <div class="flex items-baseline gap-2 pl-3 text-sm">
              <a class="font-mono text-xs hover:underline" [routerLink]="['/task-management/issue', child.key]">
                {{ child.key }}
              </a>
              <span class="truncate">{{ child.title }}</span>
              <span class="text-xs text-[var(--tui-text-tertiary)]">{{ child.stateNameKey | erpTranslate }}</span>
            </div>
          }
        </div>
      }

      @for (link of graph?.links ?? []; track link.uuid) {
        <div class="flex items-baseline gap-2 text-sm">
          <span class="text-[var(--tui-text-tertiary)]">{{ this.linkLabel(link) | erpTranslate }}</span>
          <a class="font-mono text-xs hover:underline" [routerLink]="['/task-management/issue', link.otherKey]">
            {{ link.otherKey }}
          </a>
          <span class="truncate">{{ link.otherTitle }}</span>
          <erp-button [config]="this.removeButton(link)" />
        </div>
      }

      @if (!graph?.parent && (graph?.children?.length ?? 0) === 0 && (graph?.links?.length ?? 0) === 0) {
        <span class="text-sm text-[var(--tui-text-secondary)]">{{ ISSUE_KEYS.detail.links.none | erpTranslate }}</span>
      }

      <div class="flex items-end gap-2">
        <erp-input-picker class="w-40" [config]="typePickerConfig" [control]="typeControl" />
        <erp-input class="flex-1" [config]="targetInput" [formControl]="targetControl" />
        <erp-button [config]="addButton" />
      </div>

      @if (this.error()) {
        <span class="text-xs text-[var(--tui-status-negative)]">{{ this.error()! | erpTranslate }}</span>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueLinksComponent {
  protected readonly ISSUE_KEYS = ISSUE_KEYS;

  private readonly _graphService = inject(IssueGraphService);
  private readonly _issues = inject(TaskManagementIssueOrchestrator);
  private readonly _jobs = inject(JobService);

  public readonly issueUuid = input.required<string>();

  private readonly _saving = signal<boolean>(false);

  protected readonly error = signal<string | null>(null);

  protected readonly graph = computed(() => this._graphService.getOne(this.issueUuid())());

  protected readonly typeControl = new FormControl<number | null>(ISSUE_LINK_TYPE.Blocks);
  protected readonly targetControl = new FormControl<string | null>(null);
  protected readonly parentControl = new FormControl<string | null>(null);

  protected readonly typePickerConfig: ErpInputPickerConfig = ErpInputPickerBuilder.create((b) =>
    b
      .setLabel(ISSUE_KEYS.detail.links.add.type)
      .setItems([
        { value: ISSUE_LINK_TYPE.Blocks, label: ISSUE_KEYS.detail.links.types.blocks },
        { value: ISSUE_LINK_TYPE.Duplicates, label: ISSUE_KEYS.detail.links.types.duplicates },
        { value: ISSUE_LINK_TYPE.Relates, label: ISSUE_KEYS.detail.links.types.relates },
      ])
      .setLabelKey('label')
      .setValueKey('value')
      .setStrategy('single'),
  );

  protected readonly targetInput: ErpInputConfig = ErpInputBuilder.create((b) =>
    b.setPlaceholder(ISSUE_KEYS.detail.links.add.target),
  );

  protected readonly parentInput: ErpInputConfig = ErpInputBuilder.create((b) =>
    b.setLabel(ISSUE_KEYS.detail.links.parent).setPlaceholder(ISSUE_KEYS.detail.links.setParent.placeholder),
  );

  protected readonly setParentButton: ErpButtonConfig = {
    label: ISSUE_KEYS.detail.links.setParent.submit,
    appearance: 'secondary',
    size: 'm',
    loading: this._saving,
    fn: () => this._setParentAsync(),
  };

  protected readonly detachParentButton: ErpButtonConfig = {
    label: ISSUE_KEYS.detail.links.setParent.detach,
    appearance: 'flat',
    size: 's',
    fn: () => this._setParentAsync(null),
  };

  protected readonly addButton: ErpButtonConfig = {
    label: ISSUE_KEYS.detail.links.add.submit,
    appearance: 'secondary',
    size: 'm',
    loading: this._saving,
    fn: () => this._addAsync(),
  };

  public constructor() {
    effect(() => {
      const uuid = this.issueUuid();

      if (uuid) {
        untracked(() => void this._graphService.loadAsync(uuid));
      }
    });
  }

  /** Etykieta zależna od strony krawędzi — ta sama blokada czyta się inaczej u źródła i u celu. */
  protected linkLabel(link: IssueLinkDto): string {
    switch (link.type) {
      case ISSUE_LINK_TYPE.Blocks:
        return link.isOutgoing ? ISSUE_KEYS.detail.links.types.blocks : ISSUE_KEYS.detail.links.types.blockedBy;
      case ISSUE_LINK_TYPE.Duplicates:
        return link.isOutgoing
          ? ISSUE_KEYS.detail.links.types.duplicates
          : ISSUE_KEYS.detail.links.types.duplicatedBy;
      case ISSUE_LINK_TYPE.Delivers:
        return link.isOutgoing ? ISSUE_KEYS.detail.links.types.delivers : ISSUE_KEYS.detail.links.types.deliveredBy;
      default:
        return ISSUE_KEYS.detail.links.types.relates;
    }
  }

  protected removeButton(link: IssueLinkDto): ErpButtonConfig {
    return {
      label: ISSUE_KEYS.detail.links.remove,
      appearance: 'flat',
      size: 's',
      fn: () => this._removeAsync(link),
    };
  }

  /**
   * Ustawia rodzica po kluczu czytelnym albo — z jawnym `null` — wypina zgłoszenie z hierarchii.
   *
   * <p>Pętli front nie sprawdza: robi to reguła wsadowa rekurencyjnym CTE, a handler powtarza
   * sprawdzenie jako drugą linię obrony. Trzecia kopia tej reguły w przeglądarce rozjechałaby
   * się pierwsza (`docs/backend/task-management.md` §8.2).</p>
   */
  private async _setParentAsync(explicitNull?: null): Promise<void> {
    this._saving.set(true);
    this.error.set(null);

    try {
      let parentUuid: string | undefined;

      if (explicitNull !== null) {
        const key = this.parentControl.value?.trim();

        if (!key) {
          return;
        }

        const parent = await this._issues.loadByKeyAsync(key);

        if (!parent?.uuid) {
          this.error.set(ISSUE_KEYS.detail.links.notFound);
          return;
        }

        parentUuid = parent.uuid;
      }

      await erpAwaitJobAsync(
        this._jobs,
        await this._issues.setParentAsync({ uuid: this.issueUuid(), parentUuid }),
      );

      await this._graphService.refreshAsync(this.issueUuid());
      this.parentControl.reset();
    } catch (error) {
      console.error('[IssueLinksComponent] Nie udało się zmienić rodzica.', error);
    } finally {
      this._saving.set(false);
    }
  }

  private async _addAsync(): Promise<void> {
    const key = this.targetControl.value?.trim();

    if (!key) {
      return;
    }

    this._saving.set(true);
    this.error.set(null);

    try {
      // Klucz → uuid tą samą drogą, którą karta wchodzi z linku w mailu. Nieznany klucz
      // zatrzymujemy tutaj: wysłanie pustego uuid dałoby błąd „nie znaleziono zgłoszenia”
      // opisujący nie ten problem, który wystąpił.
      const target = await this._issues.loadByKeyAsync(key);

      if (!target?.uuid) {
        this.error.set(ISSUE_KEYS.detail.links.notFound);
        return;
      }

      const command: IssueAddLinkCommand = {
        uuid: this.issueUuid(),
        linkUuid: crypto.randomUUID(),
        targetUuid: target.uuid,
        type: this.typeControl.value ?? ISSUE_LINK_TYPE.Blocks,
      };

      // Czekamy na zadanie PRZED odświeżeniem: komenda wraca z `jobUuid` natychmiast,
      // a wykonuje się później — odświeżenie od razu pobrałoby stan sprzed własnej zmiany.
      await erpAwaitJobAsync(this._jobs, await this._issues.addLinkAsync(command));
      await this._graphService.refreshAsync(this.issueUuid());

      this.targetControl.reset();
    } catch (error) {
      console.error('[IssueLinksComponent] Nie udało się dopiąć powiązania.', error);
    } finally {
      this._saving.set(false);
    }
  }

  private async _removeAsync(link: IssueLinkDto): Promise<void> {
    try {
      await erpAwaitJobAsync(
        this._jobs,
        await this._issues.removeLinkAsync({ uuid: this.issueUuid(), linkUuid: link.uuid }),
      );
      await this._graphService.refreshAsync(this.issueUuid());
    } catch (error) {
      console.error('[IssueLinksComponent] Nie udało się odpiąć powiązania.', error);
    }
  }
}
