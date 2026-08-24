import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Prezentacyjny „kto jest zalogowany" w nagłówku shellu — inicjały w kółku + imię i
 * nazwisko, e-mail jako natywny `title` (nie `tuiHint` — komponenty z `@taiga-ui/core/portals`
 * wymagają `TuiPopupService`, dostarczanego tylko wewnątrz szablonu `TuiRoot`; zawartość
 * projektowana do `<tui-root>`, czyli m.in. cały `<router-outlet>`, tego injectora nie widzi
 * — patrz analogiczny problem z `TuiAlertService` w `erp-toast.component.ts`).
 * Dane wstrzykuje `ShellLayoutComponent` (`ErpAuthService.$currentUser`, warstwa `feature`) —
 * ten komponent, jak reszta `client/ui`, nie zna `@erp/shared/auth`
 * (`type:ui` nie może zależeć od `type:auth`).
 */
@Component({
  selector: 'erp-user-badge',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="user-badge"
      [title]="email() || null"
    >
      <span class="user-badge__avatar">{{ initials() }}</span>
      <span class="user-badge__name">{{ fullName() }}</span>
    </div>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }

      .user-badge {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding-inline-end: 0.25rem;
      }

      .user-badge__avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        inline-size: 2rem;
        block-size: 2rem;
        border-radius: 50%;
        background: var(--tui-background-accent-1);
        color: var(--tui-text-primary-on-accent-1, #fff);
        font: var(--tui-typography-body-s);
        font-weight: 600;
        flex: none;
      }

      .user-badge__name {
        font: var(--tui-typography-body-s);
        font-weight: 600;
        color: var(--tui-text-primary);
        max-inline-size: 12rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      @media (max-width: 63.99rem) {
        .user-badge__name {
          display: none;
        }
      }
    `,
  ],
})
export class ErpUserBadgeComponent {
  public readonly fullName = input.required<string>();
  public readonly email = input<string>('');

  protected readonly initials = computed(() => {
    const parts = this.fullName().trim().split(/\s+/).filter(Boolean);
    const chars = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '');
    return chars.join('') || '?';
  });
}
