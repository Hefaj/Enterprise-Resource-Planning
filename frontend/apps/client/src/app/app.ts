import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TuiRoot } from '@taiga-ui/core';
import { ErpToastHostComponent } from './erp-toast-host.component';

@Component({
  imports: [RouterModule, TuiRoot, ErpToastHostComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
}
