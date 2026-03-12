import { Component } from '@angular/core';
import { CoreHostLayoutComponent } from '@erp/shared/ui';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-shell',
  imports: [CoreHostLayoutComponent, RouterModule],
  templateUrl: './shell.component.html',
})
export class ShellLayout {
  protected readonly menuConfig = {};
}
