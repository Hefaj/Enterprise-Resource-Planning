import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TuiRoot } from '@taiga-ui/core';

@Component({
  selector: 'app-task-management-entry',
  standalone: true,
  imports: [RouterOutlet, TuiRoot],
  template: `
    <tui-root>
      <router-outlet></router-outlet>
    </tui-root>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
    }
  `],
})
export class AppComponent {}
