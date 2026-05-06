import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'lib-task-management-ui',
  imports: [],
  templateUrl: './task-management-ui.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskManagementUi {}
