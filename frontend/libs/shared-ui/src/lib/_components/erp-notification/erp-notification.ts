import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { InputGroupModule } from 'primeng/inputgroup';
import { PopoverModule } from 'primeng/popover';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'erp-notification',
  imports: [PopoverModule, ButtonModule, InputGroupModule, InputTextModule],
  templateUrl: './erp-notification.html',
  styleUrl: './erp-notification.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpNotificationComponent {
  public members: any[] = [];
}
