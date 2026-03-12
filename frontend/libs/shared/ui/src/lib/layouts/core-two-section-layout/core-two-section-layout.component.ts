import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, Type } from '@angular/core';
import { EComponentSignalInputs as CoreComponentSignalInputs } from '../../_base/core-component-signal-inputs';

@Component({
  selector: 'core-two-section-layout',
  imports: [CommonModule],
  templateUrl: './core-two-section-layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoreTwoSectionLayoutComponent {
  public test2 = input<boolean>();
  public onSortChange = input<(field: string, order: number) => void>();

  public constructor() {
    const magia = new SuperDuper();

    magia.create(CoreTwoSectionLayoutComponent, {
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
