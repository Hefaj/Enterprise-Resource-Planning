import { Component, effect, ElementRef, inject, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subject, takeUntil } from 'rxjs';
import { AppMenu } from './app.menu';
import { LayoutService } from './layout.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [AppMenu, RouterModule],
  template: `
    <div class="layout-sidebar">
      <app-menu></app-menu>
    </div>
  `,
})
export class AppSidebar implements OnInit, OnDestroy {
  public layoutService = inject(LayoutService);

  public router = inject(Router);

  public el = inject(ElementRef);

  private _outsideClickListener: ((event: MouseEvent) => void) | null = null;

  private _destroy$ = new Subject<void>();

  public constructor() {
    effect(() => {
      const state = this.layoutService.layoutState();

      if (this.layoutService.isDesktop()) {
        if (state.overlayMenuActive) {
          this._bindOutsideClickListener();
        } else {
          this._unbindOutsideClickListener();
        }
      } else {
        if (state.mobileMenuActive) {
          this._bindOutsideClickListener();
        } else {
          this._unbindOutsideClickListener();
        }
      }
    });
  }

  public ngOnInit(): void {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this._destroy$),
      )
      .subscribe((event) => {
        const navEvent = event as NavigationEnd;
        this._onRouteChange(navEvent.urlAfterRedirects);
      });

    this._onRouteChange(this.router.url);
  }

  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    this._unbindOutsideClickListener();
  }

  private _onRouteChange(path: string): void {
    this.layoutService.layoutState.update((val) => ({
      ...val,
      activePath: path,
      overlayMenuActive: false,
      staticMenuMobileActive: false,
      mobileMenuActive: false,
      menuHoverActive: false,
    }));
  }

  private _bindOutsideClickListener(): void {
    if (!this._outsideClickListener) {
      this._outsideClickListener = (event: MouseEvent): void => {
        if (this._isOutsideClicked(event)) {
          this.layoutService.layoutState.update((val) => ({
            ...val,
            overlayMenuActive: false,
            staticMenuMobileActive: false,
            mobileMenuActive: false,
            menuHoverActive: false,
          }));
        }
      };

      document.addEventListener('click', this._outsideClickListener);
    }
  }

  private _unbindOutsideClickListener(): void {
    if (this._outsideClickListener) {
      document.removeEventListener('click', this._outsideClickListener);
      this._outsideClickListener = null;
    }
  }

  private _isOutsideClicked(event: MouseEvent): boolean {
    const topbarButtonEl = document.querySelector('.topbar-start > button');
    const sidebarEl = this.el.nativeElement;

    return !(
      sidebarEl?.isSameNode(event.target as Node) ||
      sidebarEl?.contains(event.target as Node) ||
      topbarButtonEl?.isSameNode(event.target as Node) ||
      topbarButtonEl?.contains(event.target as Node)
    );
  }
}
