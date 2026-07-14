import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpMenuBarComponent, ErpMenuBarBuilder } from '@erp/shared/ui';

@Component({
  selector: 'erp-product-tab',
  standalone: true,
  imports: [CommonModule, ErpMenuBarComponent],
  template: `
    <div style="padding: 1rem; display: flex; flex-direction: column; gap: 1.5rem;">
      <h3>Test komponentu ErpMenuBar (Poziomy)</h3>
      <erp-menu-bar [config]="horizontalMenu" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductTabComponent {
  protected readonly horizontalMenu = ErpMenuBarBuilder.create((b) =>
    b
      .addItem((i) =>
        i
          .setLabel('Dodaj produkt')
          .setIconStart('@tui.plus')
      )
  );
}

