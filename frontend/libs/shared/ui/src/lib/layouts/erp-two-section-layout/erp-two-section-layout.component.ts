import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'erp-two-section-layout',
  imports: [CommonModule],
  template: `
    <div class="flex h-full w-full">
      <aside class="w-64 border-r border-slate-200 bg-slate-50 overflow-y-auto">
        <ng-content select="[e-sidebar]"></ng-content>
      </aside>

      <main class="flex-1 overflow-y-auto">
        <ng-content select="[e-main]"></ng-content>
      </main>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpTwoSectionLayoutComponent {}
