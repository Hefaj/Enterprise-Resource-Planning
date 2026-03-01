import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'lib-shared-ui',
  imports: [ButtonModule],
  templateUrl: './shared-ui.html',
  styleUrl: './shared-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharedUi {}
