import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpTabsComponent, ErpTabsBuilder } from '@erp/shared/ui';
import { noop } from 'rxjs';
import { ManualExclusionTabComponent } from './manual-exclusion-tab.component';
import { DeliveryOptionsTabComponent } from './delivery-options-tab.component';

@Component({
  selector: 'erp-sales-offer-tab',
  standalone: true,
  imports: [CommonModule, ErpTabsComponent],
  template: `
    <div class="nested-tabs-container">
      <erp-tabs [config]="subTabsConfig" />
    </div>
  `,
  styles: [
    `
      .nested-tabs-container {
        height: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesOfferTabComponent {
  protected readonly subTabsConfig = ErpTabsBuilder.create((b) =>
    b
      .addTab('Ręczne wyłączenie ze sprzedaży', 'exclusion', {
        component: ManualExclusionTabComponent,
        icon: 'pi pi-eye-slash'
      })
      .addTab('Opcje dostawy produktu', 'delivery', {
        component: DeliveryOptionsTabComponent,
        icon: 'pi pi-truck'
      })
      .setInitialValue('exclusion')
      .setOnTabChange(noop)
  );
}
