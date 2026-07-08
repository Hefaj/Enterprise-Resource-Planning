import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpTranslatePipe } from '@erp/shared/ui';
import { DOCUMENT_KEYS } from '../translation/keys';

export interface MockDocument {
  id: string;
  title: string;
  author: string;
  createdAt: string;
  content: string;
}

export const MOCK_DOCUMENTS: MockDocument[] = [
  { id: '1', title: 'Faktura VAT 2026/001', author: 'Jan Kowalski', createdAt: '2026-07-01', content: 'Treść faktury VAT na kwotę 1500 PLN za usługi doradcze.' },
  { id: '2', title: 'Umowa o dzieło nr 5', author: 'Anna Nowak', createdAt: '2026-07-02', content: 'Szczegóły umowy o dzieło dotyczące stworzenia projektu graficznego sklepu internetowego.' },
  { id: '3', title: 'Podanie o urlop wypoczynkowy', author: 'Piotr Wiśniewski', createdAt: '2026-07-03', content: 'Prośba o udzielenie urlopu wypoczynkowego w terminie od 15 do 29 lipca 2026 roku.' },
  { id: '4', title: 'Raport finansowy Q2', author: 'Marek Jankowski', createdAt: '2026-07-04', content: 'Raport podsumowujący wyniki finansowe monorepo w drugim kwartale roku rozliczeniowego.' }
];

@Component({
  selector: 'erp-document-list',
  standalone: true,
  imports: [CommonModule, ErpTranslatePipe],
  template: `
    <div class="document-list-container">
      <table class="modern-table">
        <thead>
          <tr>
            <th>{{ DOCUMENT_KEYS.base.list.title | erpTranslate }}</th>
            <th>{{ DOCUMENT_KEYS.base.list.author | erpTranslate }}</th>
            <th>{{ DOCUMENT_KEYS.base.list.createdAt | erpTranslate }}</th>
            <th>{{ DOCUMENT_KEYS.base.list.actions | erpTranslate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (doc of documents; track doc.id) {
            <tr>
              <td><strong>{{ doc.title }}</strong></td>
              <td>{{ doc.author }}</td>
              <td>{{ doc.createdAt }}</td>
              <td>
                <button class="open-btn" (click)="onOpen(doc)">
                  {{ DOCUMENT_KEYS.base.list.open | erpTranslate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .document-list-container {
      padding: 1.5rem;
      background: var(--tui-background-neutral-1);
      border-radius: var(--tui-radius-l);
      margin: 1rem;
    }
    .modern-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-family: inherit;
    }
    .modern-table th {
      padding: 1rem;
      border-bottom: 2px solid var(--tui-border-normal);
      color: var(--tui-text-secondary);
      font-weight: 600;
    }
    .modern-table td {
      padding: 1rem;
      border-bottom: 1px solid var(--tui-border-light);
      color: var(--tui-text-primary);
    }
    .modern-table tr:hover {
      background: var(--tui-background-neutral-1-hover);
    }
    .open-btn {
      background: var(--tui-background-accent-1);
      color: var(--tui-text-action);
      border: 1px solid var(--tui-border-action);
      padding: 0.375rem 0.75rem;
      border-radius: var(--tui-radius-m);
      cursor: pointer;
      font-weight: 500;
      transition: background var(--tui-duration) ease;
    }
    .open-btn:hover {
      background: var(--tui-background-neutral-1-pressed);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentListComponent {
  readonly selectDocument = input.required<(doc: MockDocument) => void>();
  protected readonly documents = MOCK_DOCUMENTS;
  protected readonly DOCUMENT_KEYS = DOCUMENT_KEYS;

  protected onOpen(doc: MockDocument): void {
    const fn = this.selectDocument();
    if (fn) {
      fn(doc);
    }
  }
}
