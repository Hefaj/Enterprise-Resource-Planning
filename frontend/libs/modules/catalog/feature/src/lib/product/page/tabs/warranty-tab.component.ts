import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpEmptyCardComponent, ErpEmptyCardBuilder, ErpStepperComponent, ErpStepperBuilder } from '@erp/shared/ui';
import { PRODUCT_KEYS } from '../../translation';

@Component({
  selector: 'erp-warranty-tab',
  standalone: true,
  imports: [CommonModule, ErpStepperComponent],
  template: `
    <erp-stepper [config]="stepperConfig" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WarrantyTabComponent {
  protected readonly section1Config = ErpEmptyCardBuilder.create((b) =>
    b
      .setIcon('pi pi-verified')
      .setTitle(PRODUCT_KEYS.base.warranty.terms.title)
      .setSubtitle(PRODUCT_KEYS.base.warranty.terms.subtitle)
      .setDescription(PRODUCT_KEYS.base.warranty.terms.description)
      .setShowPulse(false)
  );

  protected readonly section2Config = ErpEmptyCardBuilder.create((b) =>
    b
      .setIcon('pi pi-wrench')
      .setTitle(PRODUCT_KEYS.base.warranty.service.title)
      .setSubtitle(PRODUCT_KEYS.base.warranty.service.subtitle)
      .setDescription(PRODUCT_KEYS.base.warranty.service.description)
      .setShowPulse(false)
  );

  protected readonly stepperConfig = ErpStepperBuilder.create((b) =>
    b
      .setInitialValue(1)
      .setLinear(false)
      .addStep(PRODUCT_KEYS.base.warranty.steps.terms, 1, {
        component: ErpEmptyCardComponent,
        config: { config: this.section1Config },
      })
      .addStep(PRODUCT_KEYS.base.warranty.steps.service, 2, {
        component: ErpEmptyCardComponent,
        config: { config: this.section2Config },
      })
  );
}

