import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, Type } from '@angular/core';
import { ErpComponentSignalInputs as CoreComponentSignalInputs } from '../../_base/erp-component-signal-inputs';

@Component({
  selector: 'erp-two-section-layout',
  imports: [CommonModule],
  templateUrl: './erp-two-section-layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpTwoSectionLayoutComponent {
  public test2 = input<boolean>();
  public onSortChange = input<(field: string, order: number) => void>();

  public constructor() {
    const magia = new SuperDuper();

    magia.create(ErpTwoSectionLayoutComponent, {
      onSortChange(field, order) {
        console.log();
      },
    });
  }
}

export class SuperDuper {
  public create<C>(component: Type<C>, inputs?: CoreComponentSignalInputs<C>): void {
    return;
  }
}
