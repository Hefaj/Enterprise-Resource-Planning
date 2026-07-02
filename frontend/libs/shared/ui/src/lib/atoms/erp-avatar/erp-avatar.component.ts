import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { TuiAvatar } from '@taiga-ui/kit';
import { ErpAvatarConfig } from './erp-avatar.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-avatar',
  standalone: true,
  imports: [TuiAvatar],
  template: `
    @let _label = label();
    @let _icon = icon();
    @let _image = image();
    @let _size = size();
    @let _shape = shape();

    @let _tuiSize = _size === 'normal' ? 'm' : (_size === 'large' ? 'l' : (_size === 'xlarge' ? 'xl' : 'm'));

    <div
      tuiAvatar
      [size]="_tuiSize"
      [class.rounded-none]="_shape === 'square'"
      [class.rounded-full]="_shape !== 'square'"
    >
      @if (_image) {
        <img [attr.alt]="_label || 'Avatar'" [attr.src]="_image" />
      } @else if (_icon) {
        <i [class]="_icon"></i>
      } @else if (_label) {
        {{ _label }}
      }
    </div>
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

