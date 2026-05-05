import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { ErpPageLayoutComponent, ErpTabsComponent, ErpTabsBuilder } from '@erp/shared/ui';
import { DmsDocumentWorkflowComponent, DocumentTableComponent, DmsDocument } from '@erp/dms/ui';

@Component({
  selector: 'erp-document',
  standalone: true,
  imports: [
    ErpPageLayoutComponent,
    ErpTabsComponent,
    DocumentTableComponent,
    DmsDocumentWorkflowComponent,
  ],
  template: `
    <erp-page-layout>
      <!-- Lewy panel: Filtry (opcjonalne w przyszłości) -->
      <div filters></div>

      <!-- Kontent -->
      <div class="flex gap-4 h-full overflow-hidden">

        <!-- Tabela dokumentów (lewa / główna kolumna) -->
        <div 
          class="flex flex-col min-w-0 transition-all duration-300 ease-in-out"
          [class]="workflowVisible() ? 'w-[55%] flex-shrink-0' : 'flex-1'"
        >
          <erp-tabs [config]="tabsConfig" [(value)]="activeTab">
            <!-- Lista dokumentów -->
            @if (activeTab() === 'list') {
              <div class="h-full">
                <dms-document-table
                  [data]="documents"
                  [(selection)]="selectedDocuments"
                />
              </div>
            }
          </erp-tabs>
        </div>

        <!-- Panel Workflow (prawy, pojawia się przy selekcji) -->
        @if (workflowVisible()) {
          <div class="flex-1 flex flex-col min-w-0 border-l border-surface-200 dark:border-surface-800 pl-4 animate-slide-in">

            <!-- Nagłówek panelu -->
            <div class="flex items-center justify-between mb-3 pb-3 border-b border-surface-100 dark:border-surface-800">
              <div class="flex items-center gap-2">
                <i class="pi pi-sitemap text-primary-500"></i>
                <span class="font-semibold text-surface-700 dark:text-surface-200">
                  Workflow dokumentu
                </span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm text-surface-500 dark:text-surface-400 max-w-48 truncate">
                  {{ singleSelectedDocument()?.name }}
                </span>
                <button
                  class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors cursor-pointer"
                  (click)="clearSelection()"
                  title="Zamknij workflow"
                >
                  <i class="pi pi-times text-sm"></i>
                </button>
              </div>
            </div>

            <!-- Komponent workflow -->
            <div class="flex-1 min-h-0">
              <erp-dms-document-workflow
                [nodes]="currentDocumentNodes()"
                [edges]="currentDocumentEdges()"
                [readonlyMode]="true"
              />
            </div>
          </div>
        }

      </div>
    </erp-page-layout>
  `,
  styles: [`
    @keyframes slide-in {
      from { opacity: 0; transform: translateX(12px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    .animate-slide-in { animation: slide-in 0.2s ease-out; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentComponent {
  protected activeTab = signal<string | number>('list');

  /** Zaznaczone dokumenty (jeden lub wiele) */
  protected selectedDocuments = signal<DmsDocument | DmsDocument[] | null>(null);

  /** Widoczność panelu workflow — tylko gdy zaznaczony DOKŁADNIE jeden dokument */
  protected workflowVisible = computed(() => {
    const sel = this.selectedDocuments();
    return Array.isArray(sel) ? sel.length === 1 : sel !== null;
  });

  /** Pojedynczy zaznaczony dokument (lub pierwszy z tablicy z 1 elementem) */
  protected singleSelectedDocument = computed<DmsDocument | null>(() => {
    const sel = this.selectedDocuments();
    if (!sel) return null;
    return Array.isArray(sel) ? (sel.length === 1 ? sel[0] : null) : sel;
  });

  /** Węzły workflow dla aktualnie zaznaczonego dokumentu */
  protected currentDocumentNodes = computed(() => {
    const doc = this.singleSelectedDocument();
    if (!doc) return [];
    return this.documentWorkflows[doc.id]?.nodes ?? this.defaultWorkflowNodes;
  });

  /** Krawędzie workflow dla aktualnie zaznaczonego dokumentu */
  protected currentDocumentEdges = computed(() => {
    const doc = this.singleSelectedDocument();
    if (!doc) return [];
    return this.documentWorkflows[doc.id]?.edges ?? this.defaultWorkflowEdges;
  });

  protected clearSelection(): void {
    this.selectedDocuments.set(null);
  }

  protected readonly tabsConfig = ErpTabsBuilder.create(b => b
    .addItem('Lista dokumentów', 'list')
    .addItem('Szablony', 'templates')
    .setInitialValue('list')
    .onTabChange(val => this.activeTab.set(val))
  );

  // ── Dane testowe ──────────────────────────────────────

  protected readonly documents: DmsDocument[] = [
    { id: 'doc-1', name: 'Faktura VAT #2024/001', type: 'Faktura', status: 'Zatwierdzony', author: 'Jan Kowalski', createdAt: new Date('2024-01-15'), updatedAt: new Date('2024-01-20'), size: '245 KB' },
    { id: 'doc-2', name: 'Umowa z Dostawcą XYZ', type: 'Umowa', status: 'W obiegu', author: 'Anna Nowak', createdAt: new Date('2024-02-01'), updatedAt: new Date('2024-02-10'), size: '1.2 MB' },
    { id: 'doc-3', name: 'Protokół odbioru Q1', type: 'Protokół', status: 'Szkic', author: 'Piotr Wiśniewski', createdAt: new Date('2024-03-05'), updatedAt: new Date('2024-03-05'), size: '89 KB' },
    { id: 'doc-4', name: 'Zamówienie #ZAM-2024-042', type: 'Zamówienie', status: 'W obiegu', author: 'Maria Kaczmarek', createdAt: new Date('2024-03-12'), updatedAt: new Date('2024-03-14'), size: '156 KB' },
    { id: 'doc-5', name: 'Raport miesięczny Marzec', type: 'Raport', status: 'Zatwierdzony', author: 'Jan Kowalski', createdAt: new Date('2024-04-01'), updatedAt: new Date('2024-04-03'), size: '2.8 MB' },
    { id: 'doc-6', name: 'Nota korygująca #NK-005', type: 'Nota', status: 'Odrzucony', author: 'Anna Nowak', createdAt: new Date('2024-04-10'), updatedAt: new Date('2024-04-15'), size: '78 KB' },
    { id: 'doc-7', name: 'Polityka bezpieczeństwa v2', type: 'Procedura', status: 'Archiwum', author: 'IT Department', createdAt: new Date('2023-12-01'), updatedAt: new Date('2024-01-01'), size: '512 KB' },
    { id: 'doc-8', name: 'Oferta handlowa #OH-2024-11', type: 'Oferta', status: 'Szkic', author: 'Piotr Wiśniewski', createdAt: new Date('2024-04-20'), updatedAt: new Date('2024-04-20'), size: '340 KB' },
  ];

  // ── Workflow per-dokument ─────────────────────────────

  private readonly defaultWorkflowNodes = [
    { id: 's1', type: 'start', label: 'Nowy dokument', position: { x: 300, y: 40 }, width: 180, status: 'completed' as const },
    { id: 'a1', type: 'approval', label: 'Akceptacja kierownika', position: { x: 250, y: 160 }, width: 220, status: 'active' as const },
    { id: 'e1', type: 'end', label: 'Zatwierdzony', position: { x: 300, y: 310 }, width: 180, status: 'pending' as const },
  ];

  private readonly defaultWorkflowEdges = [
    { id: 'e-s1-a1', source: 's1', target: 'a1', label: '' },
    { id: 'e-a1-e1', source: 'a1', target: 'e1', label: 'Zatwierdź' },
  ];

  /** Mapowanie id dokumentu → własne dane workflow */
  private readonly documentWorkflows: Record<string, { nodes: any[]; edges: any[] }> = {
    'doc-2': {
      nodes: [
        { id: 's1', type: 'start', label: 'Nowa umowa', position: { x: 300, y: 40 }, width: 180, status: 'completed' as const },
        { id: 'a1', type: 'approval', label: 'Weryfikacja prawna', position: { x: 250, y: 160 }, width: 220, status: 'completed' as const },
        { id: 'a2', type: 'approval', label: 'Akceptacja zarządu', position: { x: 250, y: 290 }, width: 220, status: 'active' as const },
        { id: 'e1', type: 'end', label: 'Podpisana', position: { x: 300, y: 430 }, width: 180, status: 'pending' as const },
      ],
      edges: [
        { id: 'e-s1-a1', source: 's1', target: 'a1', label: '' },
        { id: 'e-a1-a2', source: 'a1', target: 'a2', label: 'Zatwierdzono' },
        { id: 'e-a2-e1', source: 'a2', target: 'e1', label: 'Podpisz' },
      ],
    },
    'doc-4': {
      nodes: [
        { id: 's1', type: 'start', label: 'Nowe zamówienie', position: { x: 300, y: 40 }, width: 190, status: 'completed' as const },
        { id: 'a1', type: 'approval', label: 'Akceptacja budżetowa', position: { x: 250, y: 160 }, width: 220, status: 'active' as const },
        { id: 'e1', type: 'end', label: 'Wysłane do dostawcy', position: { x: 270, y: 310 }, width: 210, status: 'pending' as const },
      ],
      edges: [
        { id: 'e-s1-a1', source: 's1', target: 'a1', label: '' },
        { id: 'e-a1-e1', source: 'a1', target: 'e1', label: 'Zatwierdź i wyślij' },
      ],
    },
  };
}
