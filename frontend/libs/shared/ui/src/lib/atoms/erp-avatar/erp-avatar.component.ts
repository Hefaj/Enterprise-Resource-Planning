import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';

export interface ErpAvatar {
  shape?: 'square' | 'circle';
  size?: 'normal' | 'large' | 'xlarge';
  label?: string;
  icon?: string;
  image?: string;
}

@Component({
  selector: 'erp-avatar',
  imports: [AvatarModule],
  templateUrl: './erp-avatar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpAvatarComponent {
  public config = input.required<ErpAvatar>();
}
