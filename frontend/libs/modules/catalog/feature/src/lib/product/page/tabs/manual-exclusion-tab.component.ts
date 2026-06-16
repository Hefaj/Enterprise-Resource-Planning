import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpEmptyCardComponent, ErpEmptyCardBuilder } from '@erp/shared/ui';
import { PRODUCT_KEYS } from '../../translation';

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
      :host {
        display: block;
        height: 100%;
      }
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
      .setTitle(PRODUCT_KEYS.base.exclusion.title)
      .setSubtitle(PRODUCT_KEYS.base.exclusion.subtitle)
      .setDescription(PRODUCT_KEYS.base.exclusion.description)
      .setShowPulse(false)
  );
}
