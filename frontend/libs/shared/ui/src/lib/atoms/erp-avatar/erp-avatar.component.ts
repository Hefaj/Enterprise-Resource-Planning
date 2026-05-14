import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { ErpAvatarConfig } from './erp-avatar.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-avatar',
  standalone: true,
  imports: [AvatarModule],
  template: `
    @let _label = label();
    @let _icon = icon();
    @let _image = image();
    @let _size = size();
    @let _shape = shape();

    <p-avatar
      [label]="_label"
      [icon]="_icon"
      [image]="_image"
      [size]="_size"
      [shape]="_shape"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpAvatarComponent {
  public config = input.required<ErpAvatarConfig>();

  protected label = computed(() => unwrapSignal(this.config().label));
  protected icon = computed(() => unwrapSignal(this.config().icon));
  protected image = computed(() => unwrapSignal(this.config().image));
  protected size = computed(() => unwrapSignal(this.config().size));
  protected shape = computed(() => unwrapSignal(this.config().shape));
}
