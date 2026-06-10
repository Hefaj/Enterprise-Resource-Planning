import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'erp-task',
  standalone: true,
  imports: [
  ],
  template: `
    TASK!
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskComponent {
  
}
