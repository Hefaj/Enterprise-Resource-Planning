import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { ErpPageLayoutComponent, ErpPageLayoutBuilder, ErpTabsComponent, ErpTabsBuilder, ErpEmptyCardBuilder } from '@erp/shared/ui';
import { DmsDocument } from '@erp/dms/ui';
import { CommonModule } from '@angular/common';
import { noop } from 'rxjs';

@Component({
  selector: 'erp-document-status-sidebar',
  standalone: true,
  template: `
    <div class="p-4 bg-surface-50 dark:bg-surface-900/50 rounded-xl border border-surface-200 dark:border-surface-800">
      <div class="text-sm font-bold uppercase tracking-wider text-surface-500 mb-4">Statusy Dokumentów</div>
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer transition-colors">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-blue-500"></span>
            <span class="text-sm">W obiegu</span>
          </div>
          <span class="text-xs font-mono text-surface-400">12</span>
        </div>
        <div class="flex items-center justify-between p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer transition-colors">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-green-500"></span>
            <span class="text-sm">Zatwierdzone</span>
          </div>
          <span class="text-xs font-mono text-surface-400">45</span>
        </div>
      </div>
    </div>
  `
})
export class DocumentStatusSidebarComponent {}

@Component({
  selector: 'erp-document',
  standalone: true,
  imports: [CommonModule, ErpPageLayoutComponent],
  template: `
    <erp-page-layout [config]="pageConfig" />
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
      .animate-fade-in {
        animation: fadeIn 0.3s ease-out;
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentComponent {

  /** Zaznaczone dokumenty */
  protected selectedDocuments = signal<DmsDocument | DmsDocument[] | null>(null);

  /** Wyciągnięcie pojedynczego dokumentu */
  protected singleSelectedDocument = computed<DmsDocument | null>(() => {
    const sel = this.selectedDocuments();
    if (!sel) return null;
    if (Array.isArray(sel)) return sel.length === 1 ? sel[0] : null;
    return sel;
  });

  /** Dynamiczna konfiguracja zakładek */
  protected readonly tabsConfig = ErpTabsBuilder.create((b) =>
    b
      .addTab('Lista dokumentów', 'list', { icon: 'pi pi-list' })
      .addTab('Workflow obiegu', 'workflow', { icon: 'pi pi-sitemap' })
      .setInitialValue('list')
      .setOnTabChange(noop),
  );

  protected readonly pageConfig = ErpPageLayoutBuilder.create(b => b
    .setLeftSidebar(DocumentStatusSidebarComponent)
    .setMain(ErpTabsComponent, { config: this.tabsConfig })
  );

  /** Karta stanu pustego dla Workflow */
  protected readonly emptyWorkflowCardConfig = ErpEmptyCardBuilder.create((b) =>
    b
      .setIcon('pi pi-info-circle')
      .setTitle('Wybierz dokument')
      .setSubtitle('Aby zobaczyć workflow, zaznacz dokładnie jeden dokument na liście.')
      .setDescription('Zaznaczenie wielu dokumentów uniemożliwia podgląd procesu jednostkowego.')
      .setShowPulse(true)
  );

  /** Pobieranie węzłów dla zaznaczonego dokumentu */
  protected currentDocumentNodes = computed(() => {
    const doc = this.singleSelectedDocument();
    if (!doc) return [];
    return this.documentWorkflows[doc.id]?.nodes ?? this.defaultWorkflowNodes;
  });

  /** Pobieranie krawędzi dla zaznaczonego dokumentu */
  protected currentDocumentEdges = computed(() => {
    const doc = this.singleSelectedDocument();
    if (!doc) return [];
    return this.documentWorkflows[doc.id]?.edges ?? this.defaultWorkflowEdges;
  });

  // ── Dane testowe ──

  protected readonly documents: DmsDocument[] = [
    {
      id: 'doc-1',
      name: 'Faktura VAT #2024/001',
      type: 'Faktura',
      status: 'Zatwierdzony',
      author: 'Jan Kowalski',
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-20'),
      size: '245 KB',
    },
    { id: 'doc-2', name: 'Umowa z Dostawcą XYZ', type: 'Umowa', status: 'W obiegu', author: 'Anna Nowak', createdAt: new Date('2024-02-01'), updatedAt: new Date('2024-02-10'), size: '1.2 MB' },
    { id: 'doc-3', name: 'Protokół odbioru Q1', type: 'Protokół', status: 'Szkic', author: 'Piotr Wiśniewski', createdAt: new Date('2024-03-05'), updatedAt: new Date('2024-03-05'), size: '89 KB' },
    {
      id: 'doc-4',
      name: 'Zamówienie #ZAM-2024-042',
      type: 'Zamówienie',
      status: 'W obiegu',
      author: 'Maria Kaczmarek',
      createdAt: new Date('2024-03-12'),
      updatedAt: new Date('2024-03-14'),
      size: '156 KB',
    },
  ];

  private readonly defaultWorkflowNodes = [
    { id: 's1', type: 'start', label: 'Start', position: { x: 300, y: 50 }, width: 150, status: 'completed' as const },
    { id: 'a1', type: 'approval', label: 'Weryfikacja', position: { x: 275, y: 180 }, width: 200, status: 'active' as const },
    { id: 'e1', type: 'end', label: 'Koniec', position: { x: 300, y: 320 }, width: 150, status: 'pending' as const },
  ];

  private readonly defaultWorkflowEdges = [
    { id: 'e1', source: 's1', target: 'a1' },
    { id: 'e2', source: 'a1', target: 'e1' },
  ];

  private readonly documentWorkflows: Record<string, { nodes: any[]; edges: any[] }> = {
    'doc-2': {
      nodes: [
        { id: 's1', type: 'start', label: 'Nowa umowa', position: { x: 300, y: 40 }, width: 180, status: 'completed' as const },
        { id: 'a1', type: 'approval', label: 'Weryfikacja prawna', position: { x: 250, y: 160 }, width: 220, status: 'completed' as const },
        { id: 'a2', type: 'approval', label: 'Akceptacja zarządu', position: { x: 250, y: 290 }, width: 220, status: 'active' as const },
        { id: 'e1', type: 'end', label: 'Podpisana', position: { x: 300, y: 430 }, width: 180, status: 'pending' as const },
      ],
      edges: [
        { id: 'e1', source: 's1', target: 'a1' },
        { id: 'e2', source: 'a1', target: 'a2' },
        { id: 'e3', source: 'a2', target: 'e1' },
      ],
    },
  };
}
