import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';

import { JobService } from '@erp/shared/data-access';
import {
  erpAwaitJobAsync,
  IssueAddLinkCommand,
  IssueGraphService,
  IssueLinkDto,
  TaskManagementIssueOrchestrator,
} from '@erp/task-management/data-access';
import { ErpLinkListComponent, ErpLinkListRow } from '@erp/task-management/ui';
import { ISSUE_LINK_TYPE } from '@erp/task-management/util';

import { ISSUE_KEYS } from '../../translation';

/**
 * Pasek powiązań na karcie zgłoszenia — smart wrapper nad `erp-link-list` (`ui`, `NFR-009`).
 *
 * <p>Cała prezentacja (rodzic, podzadania, krawędzie grafu, formularz dodania) mieszka teraz
 * w `@erp/task-management/ui`; ten komponent trzyma wyłącznie to, co zna orkiestrator: graf,
 * rozwiązanie klucza→uuid i komendy (`docs/frontend/task-management-pages.md` §2.3).</p>
 */
@Component({
  selector: 'erp-task-management-issue-links',
  standalone: true,
  imports: [ErpLinkListComponent],
  template: `
    <erp-link-list
      [config]="this.config()"
      (setParent)="this.setParentAsync($event)"
      (detachParent)="this.setParentAsync(undefined)"
      (addLink)="this.addAsync($event.targetKey, $event.type)"
      (removeLink)="this.removeAsync($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueLinksComponent {
  private readonly _graphService = inject(IssueGraphService);
  private readonly _issues = inject(TaskManagementIssueOrchestrator);
  private readonly _jobs = inject(JobService);

  public readonly issueUuid = input.required<string>();

  private readonly _saving = signal<boolean>(false);

  protected readonly error = signal<string | undefined>(undefined);

  protected readonly graph = computed(() => this._graphService.getOne(this.issueUuid())());

  protected readonly config = computed(() => {
    const graph = this.graph();

    return {
      parent: graph?.parent ? this._toRow(graph.parent, ISSUE_KEYS.detail.links.parent, true) : undefined,
      children: (graph?.children ?? []).map((child) => ({
        uuid: child.uuid,
        key: child.key,
        title: child.title,
        relationKey: ISSUE_KEYS.detail.links.children,
        link: ['/task-management/issue', child.key],
        stateNameKey: child.stateNameKey,
      })),
      links: (graph?.links ?? []).map((link) => this._toLinkRow(link)),
      linkTypeOptions: [
        { value: ISSUE_LINK_TYPE.Blocks, label: ISSUE_KEYS.detail.links.types.blocks },
        { value: ISSUE_LINK_TYPE.Duplicates, label: ISSUE_KEYS.detail.links.types.duplicates },
        { value: ISSUE_LINK_TYPE.Relates, label: ISSUE_KEYS.detail.links.types.relates },
      ],
      saving: this._saving(),
      error: this.error(),
    };
  });

  public constructor() {
    effect(() => {
      const uuid = this.issueUuid();

      if (uuid) {
        untracked(() => void this._graphService.loadAsync(uuid));
      }
    });
  }

  /** Etykieta zależna od strony krawędzi — ta sama blokada czyta się inaczej u źródła i u celu. */
  private _linkLabel(link: IssueLinkDto): string {
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

  private _toRow(
    entry: { uuid: string; key: string; title: string },
    relationKey: string,
    removable: boolean,
  ): ErpLinkListRow {
    return {
      uuid: entry.uuid,
      key: entry.key,
      title: entry.title,
      relationKey,
      link: ['/task-management/issue', entry.key],
      removable,
    };
  }

  private _toLinkRow(link: IssueLinkDto): ErpLinkListRow {
    return {
      uuid: link.uuid,
      key: link.otherKey,
      title: link.otherTitle,
      relationKey: this._linkLabel(link),
      link: ['/task-management/issue', link.otherKey],
      stateNameKey: link.otherStateNameKey,
      removable: true,
    };
  }

  /**
   * Ustawia albo zdejmuje rodzica po kluczu czytelnym.
   *
   * <p>Pętli front nie sprawdza: robi to reguła wsadowa rekurencyjnym CTE, a handler powtarza
   * sprawdzenie jako drugą linię obrony (`docs/backend/task-management.md` §8.2).</p>
   */
  protected async setParentAsync(key: string | undefined): Promise<void> {
    this._saving.set(true);
    this.error.set(undefined);

    try {
      let parentUuid: string | undefined;

      if (key) {
        const parent = await this._issues.loadByKeyAsync(key);

        if (!parent?.uuid) {
          this.error.set(ISSUE_KEYS.detail.links.notFound);
          return;
        }

        parentUuid = parent.uuid;
      }

      await erpAwaitJobAsync(this._jobs, await this._issues.setParentAsync({ uuid: this.issueUuid(), parentUuid }));
      await this._graphService.refreshAsync(this.issueUuid());
    } catch (error) {
      console.error('[IssueLinksComponent] Nie udało się zmienić rodzica.', error);
    } finally {
      this._saving.set(false);
    }
  }

  protected async addAsync(targetKey: string, type: number): Promise<void> {
    this._saving.set(true);
    this.error.set(undefined);

    try {
      const target = await this._issues.loadByKeyAsync(targetKey);

      if (!target?.uuid) {
        this.error.set(ISSUE_KEYS.detail.links.notFound);
        return;
      }

      const command: IssueAddLinkCommand = {
        uuid: this.issueUuid(),
        linkUuid: crypto.randomUUID(),
        targetUuid: target.uuid,
        type,
      };

      await erpAwaitJobAsync(this._jobs, await this._issues.addLinkAsync(command));
      await this._graphService.refreshAsync(this.issueUuid());
    } catch (error) {
      console.error('[IssueLinksComponent] Nie udało się dopiąć powiązania.', error);
    } finally {
      this._saving.set(false);
    }
  }

  protected async removeAsync(linkUuid: string): Promise<void> {
    try {
      await erpAwaitJobAsync(this._jobs, await this._issues.removeLinkAsync({ uuid: this.issueUuid(), linkUuid }));
      await this._graphService.refreshAsync(this.issueUuid());
    } catch (error) {
      console.error('[IssueLinksComponent] Nie udało się odpiąć powiązania.', error);
    }
  }
}
