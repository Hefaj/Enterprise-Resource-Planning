import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TuiRoot } from '@taiga-ui/core';
import { ErpToastBridgeComponent } from './erp-toast-bridge.component';

@Component({
  imports: [RouterModule, TuiRoot, ErpToastBridgeComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
}
