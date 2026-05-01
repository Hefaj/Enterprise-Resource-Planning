import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, Type } from '@angular/core';
import { ErpComponentSignalInputs as CoreComponentSignalInputs } from '../../base/erp-component-signal-inputs';

@Component({
  selector: 'erp-two-section-layout',
  imports: [CommonModule],
  template: `
    <div class="h-100 flex flex-row">
      <aside class="e-layout-sidebar">
        <ng-content select="[e-sidebar]"></ng-content>
      </aside>

      <main class="grow">
        <ng-content select="[e-main]"></ng-content>
      </main>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpTwoSectionLayoutComponent {
  public test2 = input<boolean>();
  public onSortChange = input<(field: string, order: number) => void>();

  public constructor() {
    const magia = new SuperDuper();

    magia.create(ErpTwoSectionLayoutComponent, {
      onSortChange(_field, _order) {
        console.log();
      },
    });
  }
}

export class SuperDuper {
  public create<C>(_component: Type<C>, _inputs?: CoreComponentSignalInputs<C>): void {
    return;
  }
}
