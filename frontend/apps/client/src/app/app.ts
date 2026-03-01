import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';

import { AuthService } from '@auth';

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private _authService = inject(AuthService);
}
