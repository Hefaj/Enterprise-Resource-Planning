import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpButtonComponent, ErpButtonBuilder, ErpButtonConfig, ErpButtonAppearance } from '@erp/shared/ui/erp-button';

@Component({
  selector: 'erp-dashboard',
  standalone: true,
  imports: [CommonModule, ErpButtonComponent],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  public readonly btnConfigs: ErpButtonConfig[];

  constructor() {
    this.btnConfigs = [
        'primary', 'primary-destructive', 'primary-grayscale',
        'secondary', 'secondary-destructive', 'secondary-grayscale',
        'flat', 'flat-destructive', 'flat-grayscale',
        'outline', 'outline-destructive', 'outline-grayscale',
        'action', 'action-destructive', 'action-grayscale',
        'neutral', 'negative', 'positive', 'warning', 'info',
        'icon', 'floating', 'textfield', 'accent',
    ].map(x => {
    return ErpButtonBuilder.create(b => {
      b.setLabel(x).setAppearance(x as ErpButtonAppearance);
    });
  })

    
  }

}
