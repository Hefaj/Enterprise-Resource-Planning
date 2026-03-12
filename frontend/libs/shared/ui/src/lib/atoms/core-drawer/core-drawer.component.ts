import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DrawerModule } from 'primeng/drawer';

@Component({
  selector: 'core-drawer',
  imports: [DrawerModule],
  templateUrl: './core-drawer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoreDrawerComponent {
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
