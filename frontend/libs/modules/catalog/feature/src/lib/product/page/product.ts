import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { 
  ErpPageLayoutComponent, 
  ErpFiltersComponent, 
  ErpFiltersBuilder, 
  ErpInputTextBuilder, 
  ErpSelectBuilder, 
  ErpToggleSwitchBuilder, 
  ErpDatePickerBuilder, 
  ErpListFilterBuilder 
} from '@erp/shared/ui';

@Component({
  standalone: true,
  imports: [CommonModule, ErpPageLayoutComponent, ErpFiltersComponent, TabsModule],
  template: `
    <erp-page-layout>
      <!-- Lewy panel: Filtry -->
      <div filters>
        <erp-filters [config]="filtersConfig" (filterSubmit)="onFilter($event)" />
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

  protected readonly filtersConfig = ErpFiltersBuilder.create((b) => {
    b.addFilter(
      'search',
      'Szukaj',
      'text',
      ErpInputTextBuilder.create((i) => i.setPlaceholder('Szukaj produktu...').setHint('Nazwa, SKU lub EAN'))
    );

    b.addFilter(
      'category',
      'Kategoria',
      'select',
      ErpSelectBuilder.create((s) =>
        s
          .setPlaceholder('Wybierz kategorię')
          .setOptions([
            { label: 'Elektronika', value: 'elec' },
            { label: 'Dom i Ogród', value: 'home' },
            { label: 'Moda', value: 'fashion' },
          ])
      )
    );

    b.addFilter(
      'status',
      'Status',
      'list',
      ErpListFilterBuilder.create((l) =>
        l
          .setPlaceholder('Status produktu')
          .setOptions([
            { label: 'Aktywny', value: 'active' },
            { label: 'Draft', value: 'draft' },
            { label: 'Archiwalny', value: 'archived' },
          ])
          .setMultiple(true)
      )
    );

    b.addFilter(
      'isFeatured',
      'Wyróżniony',
      'switch',
      ErpToggleSwitchBuilder.create((t) => t.setPlaceholder('Tylko wyróżnione'))
    );

    b.addFilter(
      'createdAt',
      'Data utworzenia',
      'date',
      ErpDatePickerBuilder.create((d) => d.setPlaceholder('Od daty').setShowIcon(true))
    );
  });

  protected onFilter(filters: any): void {
    console.log('Applied filters:', filters);
  }
}
