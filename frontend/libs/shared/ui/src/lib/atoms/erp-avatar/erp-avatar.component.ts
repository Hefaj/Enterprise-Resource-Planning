import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { ErpAvatarBuilder } from './erp-avatar.builder';

export { ErpAvatarBuilder };

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
  template: `
    @let _config = config();

    <p-avatar
      [label]="_config.label"
      [icon]="_config.icon"
      [image]="_config.image"
      [size]="_config.size"
      [shape]="_config.shape"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpAvatarComponent {
  public config = input.required<ErpAvatar>();
}
