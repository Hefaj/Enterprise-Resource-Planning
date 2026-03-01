import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '@auth';
import { ErpBreadcrumbComponent } from '@shared-ui';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, ErpBreadcrumbComponent, ButtonModule],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent {
  private _authService = inject(AuthService);

  public logout(): void {
    this._authService.logout();
  }

  private _router = inject(Router);

  public nav(path: string): void {
    this._router.navigate([path]);
  }
}
