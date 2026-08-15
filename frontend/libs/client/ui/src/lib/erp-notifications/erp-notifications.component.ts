import { ChangeDetectionStrategy, Component, Injector, Type, input, model, output } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { TuiButton, TuiDropdown, TuiIcon, TuiLoader } from '@taiga-ui/core';
import { TuiBadgedContent, TuiBadgeNotification } from '@taiga-ui/kit';

/**
 * Dzwonek powiadomień w nagłówku — komponent czysto prezentacyjny.
 *
 * Sam nie wie nic o zadaniach: licznik dostaje inputem, a zawartość panelu to komponent
 * doładowany z remota `notification` i podany z zewnątrz razem z jego injectorem. Dzięki temu
 * warstwa `client/ui` pozostaje bez zależności od `data-access` i od kontraktów remotów,
 * a host nie musi statycznie importować mikrofrontendu.
 */
@Component({
  selector: 'erp-notifications',
  standalone: true,
  imports: [
    NgComponentOutlet,
    TuiButton,
    TuiDropdown,
    TuiIcon,
    TuiLoader,
    TuiBadgedContent,
    TuiBadgeNotification,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tui-badged-content class="notifications-container">
      <button
        tuiIconButton
        type="button"
        appearance="flat"
        size="m"
        tuiDropdownAuto
        [tuiDropdown]="panel"
        [(tuiDropdownOpen)]="open"
        class="notifications-btn"
        title="Powiadomienia"
      >
        <tui-icon [icon]="hasActivity() ? '@tui.loader' : '@tui.bell'" />
      </button>

      @if (count() > 0) {
        <tui-badge-notification tuiSlot="top" size="s">
          {{ badgeLabel() }}
        </tui-badge-notification>
      }
    </tui-badged-content>

    <ng-template #panel>
      @if (panelComponent(); as component) {
        <ng-container
          *ngComponentOutlet="component; injector: panelInjector() ?? undefined"
        />
      } @else {
        <!-- Panel otwiera się natychmiast, a komponent remota dociąga się dopiero po
             pierwszym kliknięciu — bez tego stanu użytkownik widziałby pustą ramkę. -->
        <div class="notifications-placeholder">
          <tui-loader [loading]="true" size="m" />
        </div>
      }
    </ng-template>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
    .notifications-container {
      display: block;
    }
    .notifications-btn {
      position: relative;
      cursor: pointer;
      border-radius: var(--tui-radius-m) !important;
      border: 1px solid var(--tui-border-normal) !important;
      background: var(--tui-background-neutral-1) !important;
      color: var(--tui-text-primary) !important;
      width: 2.5rem !important;
      height: 2.5rem !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transition: all 0.2s;
    }
    .notifications-btn:hover {
      background: var(--tui-background-neutral-1-hover) !important;
    }
    .notifications-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 18rem;
      padding: 2rem 1rem;
    }
  `]
})
export class ErpNotificationsComponent {
  /** Liczba na badge'u — zadania, które zmieniły stan od ostatniego otwarcia panelu. */
  public readonly count = input<number>(0);

  /** Czy cokolwiek jest w toku — zmienia ikonę dzwonka na wskaźnik pracy. */
  public readonly hasActivity = input<boolean>(false);

  /** Komponent zawartości panelu, doładowany z remota. `null` = jeszcze się ładuje. */
  public readonly panelComponent = input<Type<unknown> | null>(null);

  /** Injector z providerami modułu, z którego pochodzi `panelComponent`. */
  public readonly panelInjector = input<Injector | null>(null);

  /** Stan otwarcia — dwukierunkowy, żeby host mógł zamknąć panel po nawigacji. */
  public readonly open = model<boolean>(false);

  public readonly clickNotifications = output<void>();

  /** Powyżej 99 badge zamienia się w „99+” — trzycyfrowa liczba rozpycha ikonę. */
  protected badgeLabel(): string {
    const count = this.count();
    return count > 99 ? '99+' : String(count);
  }

  public constructor() {
    // Emituje przy każdym OTWARCIU (nie przy zamknięciu) — to sygnał dla hosta,
    // żeby doładować widżet i oznaczyć powiadomienia jako przejrzane.
    this.open.subscribe(isOpen => {
      if (isOpen) {
        this.clickNotifications.emit();
      }
    });
  }
}
