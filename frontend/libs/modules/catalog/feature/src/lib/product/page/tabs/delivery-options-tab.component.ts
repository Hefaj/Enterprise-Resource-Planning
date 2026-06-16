import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpEmptyCardComponent, ErpEmptyCardBuilder } from '@erp/shared/ui';
import { PRODUCT_KEYS } from '../../translation';

@Component({
  selector: 'erp-delivery-options-tab',
  standalone: true,
  imports: [CommonModule, ErpEmptyCardComponent],
  template: `
    <div class="tab-container">
      <div class="sections-grid">
        <div class="section-card">
          <erp-empty-card [config]="section1Config" />
        </div>
        <div class="section-card">
          <erp-empty-card [config]="section2Config" />
        </div>
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
      .sections-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 1.5rem;
        height: 100%;
      }
      @media (min-width: 1024px) {
        .sections-grid {
          grid-template-columns: 1fr 1fr;
        }
      }
      .section-card {
        height: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeliveryOptionsTabComponent {
  protected readonly section1Config = ErpEmptyCardBuilder.create((b) =>
    b
      .setIcon('pi pi-truck')
      .setTitle(PRODUCT_KEYS.base.delivery.shipping.title)
      .setSubtitle(PRODUCT_KEYS.base.delivery.shipping.subtitle)
      .setDescription(PRODUCT_KEYS.base.delivery.shipping.description)
      .setShowPulse(false)
  );

  protected readonly section2Config = ErpEmptyCardBuilder.create((b) =>
    b
      .setIcon('pi pi-box')
      .setTitle(PRODUCT_KEYS.base.delivery.packing.title)
      .setSubtitle(PRODUCT_KEYS.base.delivery.packing.subtitle)
      .setDescription(PRODUCT_KEYS.base.delivery.packing.description)
      .setShowPulse(false)
  );
}
