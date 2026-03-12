import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { PanelMenu } from 'primeng/panelmenu';

export type CorePanelMenuItem = MenuItem;

export interface CorePanelMenu {
  items: CorePanelMenuItem[];
}

@Component({
  selector: 'core-panel-menu',
  imports: [PanelMenu],
  templateUrl: './core-panel-menu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CorePanelMenuComponent {
  public readonly config = input.required<CorePanelMenu>();
}
