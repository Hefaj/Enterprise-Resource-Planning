import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ErpTranslatePipe, unwrapSignal } from '@erp/shared/ui';

import { ErpProjectConfigurationSectionConfig } from './erp-project-configuration-section.types';

/**
 * Ramka zakładki konfiguracji projektu. Zapewnia jednolity nagłówek i odstępy; nie zna danych
 * projektu ani komend, które są odpowiedzialnością smart componentu w feature.
 */
@Component({
  selector: 'erp-project-configuration-section',
  standalone: true,
  imports: [ErpTranslatePipe],
  template: `
    <section class="flex flex-col gap-4">
      <header class="flex flex-col gap-1">
        <h2 class="m-0 text-sm font-medium">{{ this.title() | erpTranslate }}</h2>
        @if (this.description(); as description) {
          <p class="m-0 text-sm text-[var(--tui-text-secondary)]">{{ description | erpTranslate }}</p>
        }
      </header>
      <ng-content />
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpProjectConfigurationSectionComponent {
  public readonly config = input.required<ErpProjectConfigurationSectionConfig>();
  protected readonly title = computed(() => unwrapSignal(this.config().title));
  protected readonly description = computed(() => unwrapSignal(this.config().description));
}
