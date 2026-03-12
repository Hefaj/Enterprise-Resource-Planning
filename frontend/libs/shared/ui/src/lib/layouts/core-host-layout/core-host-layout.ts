import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CoreEmptyCardComponent } from '../../atoms/core-empty-card/core-empty-card.component';
import { CoreDrawerComponent } from '../../atoms/core-drawer/core-drawer.component';
import { CoreButtonComponent } from '../../atoms/core-button/core-button.component';
import { CoreButtonBuilder } from '../../atoms/core-button/core-button.builder';
import { CorePanelMenu, CorePanelMenuComponent } from '../../atoms/core-panel-menu/core-panel-menu.component';

@Component({
  selector: 'core-host-layout',
  imports: [CoreEmptyCardComponent, CoreDrawerComponent, CoreButtonComponent, CorePanelMenuComponent],
  templateUrl: './core-host-layout.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoreHostLayoutComponent {
  protected readonly menuBtn = CoreButtonBuilder.create((b) => b.setSeverity('info').setIcon('pi pi-bars'));

  public readonly $panelMenuConfig = signal<CorePanelMenu>({
    items: [{ label: 'A' }],
  });
}
