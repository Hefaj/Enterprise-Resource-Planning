import { Component, computed, inject, input } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { StyleClassModule } from 'primeng/styleclass';
import { AppConfigurator } from './app.configurator';
import { CommonModule } from '@angular/common';
import { LayoutService } from './layout.service';

@Component({
  selector: 'app-floating-configurator',
  imports: [CommonModule, ButtonModule, StyleClassModule, AppConfigurator],
  template: `
    <div
      class="flex gap-4 top-8 right-8"
      [ngClass]="{ fixed: float() }"
    >
      <p-button
        type="button"
        (onClick)="toggleDarkMode()"
        [rounded]="true"
        [icon]="isDarkTheme() ? 'pi pi-moon' : 'pi pi-sun'"
        severity="secondary"
      />
      <div class="relative">
        <p-button
          icon="pi pi-palette"
          pStyleClass="@next"
          enterFromClass="hidden"
          enterActiveClass="animate-scalein"
          leaveToClass="hidden"
          leaveActiveClass="animate-fadeout"
          [hideOnOutsideClick]="true"
          type="button"
          rounded
        />
        <app-configurator />
      </div>
    </div>
  `,
})
export class AppFloatingConfigurator {
  public LayoutService = inject(LayoutService);

  public float = input<boolean>(true);

  public isDarkTheme = computed(() => this.LayoutService.layoutConfig().darkTheme);

  public toggleDarkMode(): void {
    this.LayoutService.layoutConfig.update((state) => ({ ...state, darkTheme: !state.darkTheme }));
  }
}
