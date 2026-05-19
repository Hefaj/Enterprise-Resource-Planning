import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpEmptyCardComponent, ErpEmptyCardBuilder } from '@erp/shared/ui/erp-empty-card';

@Component({
  selector: 'erp-manual-exclusion-tab',
  standalone: true,
  imports: [CommonModule, ErpEmptyCardComponent],
  template: `
    <div class="tab-container">
      <div class="section-container">
        <erp-empty-card [config]="sectionConfig" />
      </div>
    </div>
  `,
  styles: [
    `
      .tab-container {
        padding: 1rem 0;
        height: 100%;
        box-sizing: border-box;
      }
      .section-container {
        height: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManualExclusionTabComponent {
  protected readonly sectionConfig = ErpEmptyCardBuilder.create((b) =>
    b
      .setIcon('pi pi-eye-slash')
      .setTitle('Ręczne wyłączenie ze sprzedaży')
      .setSubtitle('Status widoczności oferty')
      .setDescription('Umożliwia tymczasowe lub stałe zablokowanie produktu w kanałach sprzedaży bez usuwania jego definicji.')
      .setShowPulse(false)
  );
}
