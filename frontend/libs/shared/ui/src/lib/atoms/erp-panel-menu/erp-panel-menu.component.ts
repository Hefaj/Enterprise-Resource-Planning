import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { PanelMenu } from 'primeng/panelmenu';

export type ErpPanelMenuItem = MenuItem;

export interface ErpPanelMenu {
  items: ErpPanelMenuItem[];
}

@Component({
  selector: 'erp-panel-menu',
  imports: [PanelMenu],
  templateUrl: './erp-panel-menu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpPanelMenuComponent {
  public readonly config = input.required<ErpPanelMenu>();
}
