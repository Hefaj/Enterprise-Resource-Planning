import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DrawerModule } from 'primeng/drawer';

@Component({
  selector: 'erp-drawer',
  imports: [DrawerModule],
  templateUrl: './erp-drawer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpDrawerComponent {
  protected readonly visible = signal(false);

  public toggle(): void {
    this.visible.update((v) => !v);
  }

  public show(): void {
    this.visible.set(true);
  }

  public hide(): void {
    this.visible.set(false);
  }
}
