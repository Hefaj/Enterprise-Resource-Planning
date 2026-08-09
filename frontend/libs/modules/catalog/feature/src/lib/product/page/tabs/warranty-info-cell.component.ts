import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiSkeleton } from '@taiga-ui/kit';
import { CatalogWarrantyOrchestrator, WarrantyVM } from '@erp/catalog/data-access';
import { WarrantyRow } from './warranty-row.model';

export type WarrantyInfoField = 'name' | 'durationMonths' | 'description';

/**
 * Generyczna komórka tekstowa tabeli gwarancji — sama rozwiązuje katalogowe `WarrantyVM`
 * po `warrantyUuid` z cache orkiestratora (reaktywnie) i wyświetla wskazane pole (`field`).
 */
@Component({
  selector: 'erp-warranty-info-cell',
  standalone: true,
  imports: [CommonModule, TuiSkeleton],
  template: `
    @if (!_vm()) {
      <span [tuiSkeleton]="true" class="rounded-sm inline-flex items-center min-w-[3rem] min-h-[1.25rem] max-w-full"></span>
    } @else {
      <span>{{ _text() }}</span>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WarrantyInfoCellComponent {
  public readonly row = input.required<WarrantyRow>();
  public readonly field = input.required<WarrantyInfoField>();

  private readonly warrantyOrchestrator = inject(CatalogWarrantyOrchestrator);

  protected readonly _vm = computed<WarrantyVM | undefined>(() =>
    this.warrantyOrchestrator.getOne(this.row().warrantyUuid)()
  );

  protected readonly _text = computed(() => {
    const vm = this._vm();
    if (!vm) return '';

    switch (this.field()) {
      case 'name':
        return vm.name ?? '—';
      case 'durationMonths':
        return vm.durationMonths != null ? `${vm.durationMonths}` : '—';
      case 'description':
        return vm.description ?? '—';
      default:
        return '—';
    }
  });
}
