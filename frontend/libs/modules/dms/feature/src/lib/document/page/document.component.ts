import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
  imports: [CommonModule],
  template: `
    <div class="flex flex-col h-full">
      <div class="p-4 bg-surface-100 dark:bg-surface-800 flex justify-between items-center border-b border-surface-200 dark:border-surface-700">
        <h2 class="text-lg font-bold">Dokumenty</h2>
        <div class="flex gap-2">
        </div>
      </div>
      <div class="flex-1">
      </div>
    </div>
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
}
