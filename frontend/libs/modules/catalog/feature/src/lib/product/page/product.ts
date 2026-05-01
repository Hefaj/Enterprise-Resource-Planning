import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { ErpPageLayoutComponent, ErpInputTextBuilder, ErpInputTextComponent, ErpButtonBuilder, ErpButtonComponent } from '@erp/shared/ui';

@Component({
  standalone: true,
  imports: [CommonModule, ErpPageLayoutComponent, ErpInputTextComponent, ErpButtonComponent, TabsModule],
  template: `
    <erp-page-layout>
      <!-- Lewy panel: Filtry -->
      <div filters class="flex flex-col gap-6">
        <erp-input-text [config]="searchFilter" />
        <erp-input-text [config]="categoryFilter" />

        <div class="mt-4 pt-6 border-t border-slate-100">
          <erp-button [config]="applyBtn" class="w-full" />
        </div>
      </div>

      <!-- Nagłówek: Zakładki -->
      <div header>
        <p-tabs [value]="activeTab()" (valueChange)="activeTab.set($event)">
          <p-tablist>
            <p-tab value="0">Lista produktów</p-tab>
            <p-tab value="1">Multimedia</p-tab>
            <p-tab value="2">Magazyn</p-tab>
            <p-tab value="3">Historia zmian</p-tab>
          </p-tablist>
        </p-tabs>
      </div>

      <!-- Kontent -->
      <div class="h-full">
        @if (activeTab() === '0') {
          <div class="h-full flex items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/50 text-slate-400">
            Tabela z produktami (Zakładka 0)
          </div>
        } @else if (activeTab() === '1') {
          <div class="h-full flex items-center justify-center border-2 border-dashed border-cyan-200 rounded-2xl bg-cyan-50/50 text-cyan-400">
            Sekcja Multimedia (Zakładka 1)
          </div>
        } @else if (activeTab() === '2') {
          <div class="h-full flex items-center justify-center border-2 border-dashed border-orange-200 rounded-2xl bg-orange-50/50 text-orange-400">
            Stany Magazynowe (Zakładka 2)
          </div>
        } @else {
          <div class="h-full flex items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/50 text-slate-400">
            Historia zmian (Zakładka 3)
          </div>
        }
      </div>
    </erp-page-layout>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductComponent {
  public activeTab = signal<string | number | undefined>('0');

  protected readonly searchFilter = ErpInputTextBuilder.create((b) => b.setPlaceholder('Szukaj produktu...').setHint('Nazwa, SKU lub EAN'));

  protected readonly categoryFilter = ErpInputTextBuilder.create((b) => b.setPlaceholder('Kategoria').setHint('Wybierz grupę'));
  protected readonly applyBtn = ErpButtonBuilder.create((b) => b.setLabel('Filtruj').setSeverity('info'));
}
