import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiIcon } from '@taiga-ui/core';

import { ErpButtonComponent, ErpButtonConfig, ErpToastService, ErpTranslatePipe, unwrapSignal } from '@erp/shared/ui';

import { ErpIssueKeyConfig } from './erp-issue-key.types';
import { TASKMANAGEMENT_KEYS } from '../translation';

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
  imports: [RouterLink, TuiIcon, ErpButtonComponent, ErpTranslatePipe],
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

    @if (this.copyable()) {
      <erp-button [config]="this.copyButton" [title]="TASKMANAGEMENT_KEYS.issueKey.copyLink | erpTranslate" />
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
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
  protected readonly TASKMANAGEMENT_KEYS = TASKMANAGEMENT_KEYS;

  private readonly _toast = inject(ErpToastService);

  public readonly config = input.required<ErpIssueKeyConfig>();

  protected readonly issueKey = computed(() => unwrapSignal(this.config().issueKey));
  protected readonly typeIcon = computed(() => unwrapSignal(this.config().typeIcon));
  protected readonly typeName = computed(() => unwrapSignal(this.config().typeName) ?? '');
  protected readonly link = computed(() => unwrapSignal(this.config().link));
  protected readonly copyable = computed(() => !!unwrapSignal(this.config().copyable));
  protected readonly title = computed(() => unwrapSignal(this.config().title));

  protected readonly copyButton: ErpButtonConfig = {
    label: '',
    appearance: 'flat',
    size: 'xs',
    iconStart: '@tui.copy',
    fn: (): Promise<void> => this.copyLinkAsync(),
  };

  /**
   * Kopiuje link do karty zgłoszenia wzorem YouTrack: `DEV-1 Tytuł`, gdzie klucz jest
   * hiperłączem, a reszta zwykłym tekstem — po stałej trasie po kluczu czytelnym
   * (`docs/frontend/task-management-pages.md` §9.1), nie po `link()`: ten bywa `undefined`
   * właśnie tam, gdzie kopiowanie ma największy sens (nagłówek karty — już tu jesteśmy, więc
   * nikt by tego linku nie potrzebował do nawigacji).
   *
   * <p>Schowek dostaje DWA formaty naraz (`ClipboardItem`): `text/html` dla wklejenia do edytora
   * (komentarz, mail, dokument) pokazuje klucz jako link; `text/plain` dla wklejenia do zwykłego
   * pola tekstowego pokazuje `DEV-1 Tytuł` — zwykły tekst nie umie nieść hiperłącza.</p>
   */
  protected async copyLinkAsync(): Promise<void> {
    const key = this.issueKey() ?? '';
    const title = this.title();
    const url = `${location.origin}/task-management/issue/${key}`;
    const text = title ? `${key} ${title}` : key;
    const html = `<a href="${url}">${_escapeHtml(key)}</a>${title ? ` ${_escapeHtml(title)}` : ''}`;

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([text], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        }),
      ]);
      this._toast.show({ message: TASKMANAGEMENT_KEYS.issueKey.copied, appearance: 'positive' });
    } catch (error) {
      console.error('[ErpIssueKeyComponent] Nie udało się skopiować linku.', error);
    }
  }
}

function _escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
