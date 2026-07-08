import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ErpPageLayoutBuilder,
  ErpPageLayoutComponent,
  ErpTabsComponent,
  ErpTabsConfig,
  ErpTabItem,
} from '@erp/shared/ui';
import { provideDocumentTranslations, DOCUMENT_KEYS } from '../translation';
import { DocumentListComponent, MockDocument } from './document-list.component';
import { DocumentDetailComponent } from './document-detail.component';
import { DocumentAccountingComponent } from './document-accounting.component';
import { DocumentSubstantiveComponent } from './document-substantive.component';
import { DocumentHistoryComponent } from './document-history.component';

interface OpenTabInfo {
  tabId: string;
  document: MockDocument;
}

@Component({
  selector: 'erp-document',
  standalone: true,
  imports: [ErpPageLayoutComponent],
  providers: [provideDocumentTranslations()],
  template: `<erp-page-layout [config]="pageConfig()" />`,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      min-height: 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentComponent {
  // Track open document tabs
  private readonly openTabs = signal<OpenTabInfo[]>([]);
  
  // Track currently active tab ID ('list' or a dynamic doc tab ID)
  private readonly activeTabId = signal<string>('list');

  // Computed configuration for ErpTabsComponent
  protected readonly tabsConfig = computed<ErpTabsConfig>(() => {
    const listTab: ErpTabItem = {
      id: 'list',
      label: DOCUMENT_KEYS.base.tabs.list,
      component: DocumentListComponent,
      inputs: {
        selectDocument: (doc: MockDocument) => this.openDocument(doc)
      }
    };

    const docTabs = this.openTabs().map((tab) => ({
      id: tab.tabId,
      label: { key: DOCUMENT_KEYS.base.tabs.detail, params: { title: tab.document.title } },
      closable: true,
      children: [
        {
          id: `${tab.tabId}-basic`,
          label: DOCUMENT_KEYS.base.tabs.basicInfo,
          component: DocumentDetailComponent,
          inputs: {
            document: tab.document
          }
        },
        {
          id: `${tab.tabId}-accounting`,
          label: DOCUMENT_KEYS.base.tabs.accountingDescription,
          component: DocumentAccountingComponent,
          inputs: {
            document: tab.document
          }
        },
        {
          id: `${tab.tabId}-substantive`,
          label: DOCUMENT_KEYS.base.tabs.substantiveDescription,
          component: DocumentSubstantiveComponent,
          inputs: {
            document: tab.document
          }
        },
        {
          id: `${tab.tabId}-history`,
          label: DOCUMENT_KEYS.base.tabs.history,
          component: DocumentHistoryComponent,
          inputs: {
            document: tab.document
          }
        }
      ]
    } as ErpTabItem));

    return {
      tabs: [listTab, ...docTabs],
      initialValue: this.activeTabId(),
      onTabChange: (tabId) => {
        this.activeTabId.set(tabId);
      },
      onTabClose: (tabId) => {
        this.closeDocument(tabId);
      }
    };
  });

  protected readonly pageConfig = computed(() =>
    ErpPageLayoutBuilder.create((b) =>
      b.setMain(ErpTabsComponent, { config: this.tabsConfig() })
    )
  );

  private openDocument(doc: MockDocument): void {
    const existing = this.openTabs().find((t) => t.document.id === doc.id);
    if (existing) {
      // Document already open, switch to its active tab
      this.activeTabId.set(existing.tabId);
    } else {
      // Generate instance-based tabId to circumvent the closedTabIds limitation in ErpTabsComponent
      const tabId = `doc-${doc.id}-${Date.now()}`;
      this.openTabs.update((tabs) => [...tabs, { tabId, document: doc }]);
      this.activeTabId.set(tabId);
    }
  }

  private closeDocument(tabId: string): void {
    this.openTabs.update((tabs) => tabs.filter((t) => t.tabId !== tabId));
  }
}
