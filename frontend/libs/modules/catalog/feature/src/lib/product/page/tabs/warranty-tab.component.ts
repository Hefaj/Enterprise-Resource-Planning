import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpEmptyCardComponent, ErpEmptyCardBuilder, ErpStepperComponent, ErpStepperBuilder } from '@erp/shared/ui';

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
      .setTitle('Warunki gwarancji')
      .setSubtitle('Warunki i okres ochrony')
      .setDescription('Konfiguracja typów gwarancji (producenta, sprzedawcy), okresów trwania oraz zakresu ochrony.')
      .setShowPulse(false)
  );

  protected readonly section2Config = ErpEmptyCardBuilder.create((b) =>
    b
      .setIcon('pi pi-wrench')
      .setTitle('Procedury reklamacyjne')
      .setSubtitle('Serwis i reklamacje')
      .setDescription('Zarządzanie adresami serwisowymi, formularzami zgłoszeń RMA i procedurami zwrotów towarów uszkodzonych.')
      .setShowPulse(false)
  );

  protected readonly stepperConfig = ErpStepperBuilder.create((b) =>
    b
      .setInitialValue(1)
      .setLinear(false)
      .addStep('Krok 1: Warunki', 1, {
        component: ErpEmptyCardComponent,
        config: { config: this.section1Config },
      })
      .addStep('Krok 2: Serwis', 2, {
        component: ErpEmptyCardComponent,
        config: { config: this.section2Config },
      })
  );
}

