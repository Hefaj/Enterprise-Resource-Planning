import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { ErpAuthService } from '@erp/shared/auth';
import { AppLanguage, ErpLanguageService, ErpThemeService } from '@erp/shared/data-access';

import { ErpButtonBuilder, ErpButtonComponent } from '../../atoms/erp-button';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { SHARED_KEYS } from '../../translation/keys';
import { ErpCursorVarsDirective } from './erp-cursor-vars.directive';

const AUTH_KEYS = SHARED_KEYS.auth;

@Component({
  selector: 'erp-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TuiButton, TuiIcon, ErpButtonComponent, ErpCursorVarsDirective, ErpTranslatePipe],
  template: `
    <div class="login">
      <!-- ── Panel marki ─────────────────────────────────────────────── -->
      <section
        erpCursorVars
        class="brand"
      >
        <div
          class="brand__decor"
          aria-hidden="true"
        >
          <span class="brand__aurora brand__aurora--primary"></span>
          <span class="brand__aurora brand__aurora--secondary"></span>
          <span class="brand__grid"></span>
          <span class="brand__grid brand__grid--lit"></span>
          <span class="brand__glow"></span>
        </div>

        <div class="brand__content">
          <div class="brand__lockup">
            <span class="brand__mark">
              <svg
                viewBox="0 0 48 48"
                class="brand__glyph"
                [attr.aria-label]="AUTH_KEYS.a11y.decoration | erpTranslate"
                role="img"
              >
                <defs>
                  <linearGradient
                    id="erpLoginMark"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="1"
                  >
                    <stop
                      offset="0"
                      stop-color="#9db2ff"
                    />
                    <stop
                      offset="1"
                      stop-color="#4b62c9"
                    />
                  </linearGradient>
                </defs>
                <path
                  d="M24 3.5 44.5 14.75 24 26 3.5 14.75Z"
                  fill="url(#erpLoginMark)"
                />
                <path
                  d="M3.5 22.5 24 33.75 44.5 22.5"
                  fill="none"
                  stroke="url(#erpLoginMark)"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  opacity="0.7"
                />
                <path
                  d="M3.5 30.5 24 41.75 44.5 30.5"
                  fill="none"
                  stroke="url(#erpLoginMark)"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  opacity="0.4"
                />
              </svg>
            </span>
            <span class="brand__wordmark">ERP</span>
          </div>

          <div class="brand__copy">
            <p class="brand__tagline">{{ AUTH_KEYS.brand.tagline | erpTranslate }}</p>
            <p class="brand__description">{{ AUTH_KEYS.brand.description | erpTranslate }}</p>
          </div>

          <ul class="brand__modules">
            @for (moduleKey of moduleKeys; track moduleKey) {
              <li class="brand__module">{{ moduleKey | erpTranslate }}</li>
            }
          </ul>

          <p class="brand__copyright">{{ AUTH_KEYS.footer.copyright | erpTranslate: { year: currentYear } }}</p>
        </div>
      </section>

      <!-- ── Panel formularza ────────────────────────────────────────── -->
      <section class="panel">
        <div
          erpCursorVars
          class="card"
          [class.card--leaving]="isLeaving()"
        >
          <header class="card__header">
            <h1 class="card__title">{{ AUTH_KEYS.login.title | erpTranslate }}</h1>
            <p class="card__subtitle">{{ AUTH_KEYS.login.subtitle | erpTranslate }}</p>
          </header>

          <div class="form">
            @if (errorKey(); as key) {
              <p
                class="alert"
                role="alert"
              >
                <tui-icon
                  icon="@tui.triangle-alert"
                  class="alert__icon"
                />
                <span>{{ key | erpTranslate }}</span>
              </p>
            }

            <div class="cta">
              <erp-button [config]="submitConfig" />
            </div>
          </div>

          <footer class="card__footer">
            <div
              class="segmented"
              role="group"
              [attr.aria-label]="AUTH_KEYS.a11y.toggleLanguage | erpTranslate"
            >
              @for (option of languageOptions; track option.value) {
                <button
                  type="button"
                  class="segmented__option"
                  [class.segmented__option--active]="language() === option.value"
                  [attr.aria-pressed]="language() === option.value"
                  (click)="setLanguage(option.value)"
                >
                  {{ option.label }}
                </button>
              }
            </div>

            <button
              tuiIconButton
              type="button"
              size="s"
              appearance="flat"
              [attr.aria-label]="AUTH_KEYS.a11y.toggleTheme | erpTranslate"
              (click)="toggleTheme()"
            >
              <tui-icon [icon]="isDarkMode() ? '@tui.sun' : '@tui.moon'" />
            </button>
          </footer>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        block-size: 100%;
        overflow: hidden;
      }

      .login {
        display: grid;
        grid-template-columns: 1.1fr minmax(24rem, 0.9fr);
        block-size: 100%;
        min-block-size: 100dvh;
        background: var(--tui-background-base-alt);
      }

      /* ── Panel marki ───────────────────────────────────────────────── */

      .brand {
        position: relative;
        display: flex;
        overflow: hidden;
        isolation: isolate;
        background:
          radial-gradient(120% 90% at 15% 10%, #1b2450 0%, transparent 60%),
          linear-gradient(155deg, #0a0e1f 0%, #10162e 45%, #070a16 100%);
        color: #eef1ff;
      }

      .brand__decor {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .brand__decor > * {
        position: absolute;
        display: block;
      }

      .brand__aurora {
        inline-size: 38rem;
        block-size: 38rem;
        border-radius: 50%;
        filter: blur(90px);
        will-change: transform;
      }

      .brand__aurora--primary {
        inset-block-start: -12rem;
        inset-inline-start: -8rem;
        background: rgba(82, 110, 211, 0.5);
        animation: brand-drift-a 28s ease-in-out infinite alternate;
      }

      .brand__aurora--secondary {
        inset-block-end: -16rem;
        inset-inline-end: -12rem;
        background: rgba(255, 112, 67, 0.22);
        animation: brand-drift-b 36s ease-in-out infinite alternate;
      }

      .brand__grid {
        inset: 0;
        background-image:
          linear-gradient(to right, rgba(255, 255, 255, 0.055) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.055) 1px, transparent 1px);
        background-size: 3rem 3rem;
        mask-image: linear-gradient(to bottom, #000 0%, rgba(0, 0, 0, 0.35) 60%, transparent 92%);
      }

      /* Siatka „zapalana” kursorem — widoczna tylko w promieniu wskaźnika. */
      .brand__grid--lit {
        background-image:
          linear-gradient(to right, rgba(157, 178, 255, 0.55) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(157, 178, 255, 0.55) 1px, transparent 1px);
        mask-image: radial-gradient(
          14rem 14rem at var(--cursor-x, 50%) var(--cursor-y, 50%),
          #000 0%,
          rgba(0, 0, 0, 0.35) 45%,
          transparent 72%
        );
        opacity: var(--cursor-inside, 0);
        transition: opacity 0.5s ease;
      }

      .brand__glow {
        inset: 0;
        background: radial-gradient(
          24rem 24rem at var(--cursor-x, 50%) var(--cursor-y, 50%),
          rgba(122, 149, 240, 0.22),
          transparent 70%
        );
        opacity: var(--cursor-inside, 0);
        transition: opacity 0.6s ease;
      }

      .brand__content {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 2.5rem;
        inline-size: 100%;
        max-inline-size: 34rem;
        margin: auto;
        padding: 4rem 3.5rem;
        transform: translate3d(calc(var(--cursor-nx, 0) * 6px), calc(var(--cursor-ny, 0) * 5px), 0);
        transition: transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
      }

      .brand__lockup {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .brand__mark {
        display: block;
        inline-size: 3rem;
        block-size: 3rem;
        transform: perspective(600px) rotateX(calc(var(--cursor-ny, 0) * -10deg))
          rotateY(calc(var(--cursor-nx, 0) * 12deg));
        transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
      }

      .brand__glyph {
        display: block;
        inline-size: 100%;
        block-size: 100%;
        filter: drop-shadow(0 0 18px rgba(108, 134, 226, 0.45));
      }

      .brand__wordmark {
        font: var(--tui-typography-heading-h4);
        font-weight: 700;
        letter-spacing: 0.32em;
        text-transform: uppercase;
      }

      .brand__copy {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .brand__tagline {
        margin: 0;
        font: var(--tui-typography-heading-h2);
        font-weight: 600;
        line-height: 1.15;
        text-wrap: balance;
      }

      .brand__description {
        margin: 0;
        max-inline-size: 30rem;
        font: var(--tui-typography-body-l);
        color: rgba(238, 241, 255, 0.62);
        text-wrap: pretty;
      }

      .brand__modules {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .brand__module {
        padding: 0.375rem 0.875rem;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.04);
        font: var(--tui-typography-body-s);
        color: rgba(238, 241, 255, 0.75);
        cursor: default;
        transition:
          border-color 0.25s ease,
          background 0.25s ease,
          color 0.25s ease,
          transform 0.25s ease;
      }

      .brand__module:hover {
        border-color: rgba(157, 178, 255, 0.55);
        background: rgba(157, 178, 255, 0.12);
        color: #fff;
        transform: translateY(-2px);
      }

      .brand__copyright {
        margin: 0;
        font: var(--tui-typography-body-xs);
        color: rgba(238, 241, 255, 0.35);
      }

      /* ── Panel formularza ──────────────────────────────────────────── */

      .panel {
        display: flex;
        align-items: center;
        justify-content: center;
        overflow-y: auto;
        padding: 2.5rem 2rem;
      }

      .card {
        position: relative;
        inline-size: 100%;
        max-inline-size: 24rem;
        padding: 2.5rem 2.25rem;
        border: 1px solid var(--tui-border-normal);
        border-radius: 1.5rem;
        background: var(--tui-background-base);
        box-shadow: var(--tui-shadow-small);
        transition:
          opacity 0.32s ease,
          transform 0.32s ease;
      }

      /* Obwódka podświetlana kursorem (gradient maskowany do 1px ramki). */
      .card::before {
        content: '';
        position: absolute;
        inset: 0;
        padding: 1px;
        border-radius: inherit;
        background: radial-gradient(
          13rem 13rem at var(--cursor-x, 50%) var(--cursor-y, 50%),
          var(--tui-background-accent-1),
          transparent 68%
        );
        mask:
          linear-gradient(#000 0 0) content-box,
          linear-gradient(#000 0 0);
        mask-composite: exclude;
        -webkit-mask:
          linear-gradient(#000 0 0) content-box,
          linear-gradient(#000 0 0);
        -webkit-mask-composite: xor;
        opacity: var(--cursor-inside, 0);
        transition: opacity 0.4s ease;
        pointer-events: none;
      }

      .card--leaving {
        opacity: 0;
        transform: translateY(-0.75rem) scale(0.98);
      }

      .card__header {
        margin-block-end: 2rem;
      }

      .card__title {
        margin: 0 0 0.5rem;
        font: var(--tui-typography-heading-h4);
        color: var(--tui-text-primary);
      }

      .card__subtitle {
        margin: 0;
        font: var(--tui-typography-body-s);
        color: var(--tui-text-secondary);
        text-wrap: pretty;
      }

      .form {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .cta {
        position: relative;
        margin-block-start: 0.5rem;
      }

      /* Poświata pod przyciskiem, wzmacniana przy najechaniu. */
      .cta::before {
        content: '';
        position: absolute;
        inset: 0.25rem 0.75rem;
        border-radius: 999px;
        background: var(--tui-background-accent-1);
        filter: blur(18px);
        opacity: 0.25;
        transition: opacity 0.3s ease;
        pointer-events: none;
      }

      .cta:hover::before {
        opacity: 0.5;
      }

      .cta erp-button {
        position: relative;
        display: block;
      }

      .alert {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        margin: 0;
        padding: 0.75rem 0.875rem;
        border: 1px solid var(--tui-status-negative);
        border-radius: var(--tui-radius-m);
        background: var(--tui-status-negative-pale);
        font: var(--tui-typography-body-s);
        color: var(--tui-text-primary);
        animation: alert-enter 0.4s cubic-bezier(0.22, 1, 0.36, 1);
      }

      .alert__icon {
        flex: none;
        color: var(--tui-status-negative);
      }

      .card__footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-block-start: 2rem;
        padding-block-start: 1.25rem;
        border-block-start: 1px solid var(--tui-border-normal);
      }

      .segmented {
        display: inline-flex;
        gap: 0.125rem;
        padding: 0.125rem;
        border-radius: 999px;
        background: var(--tui-background-neutral-1);
      }

      .segmented__option {
        padding: 0.25rem 0.75rem;
        border: none;
        border-radius: 999px;
        background: transparent;
        font: var(--tui-typography-body-xs);
        font-weight: 600;
        color: var(--tui-text-secondary);
        cursor: pointer;
        transition:
          background 0.2s ease,
          color 0.2s ease;
      }

      .segmented__option:hover {
        color: var(--tui-text-primary);
      }

      .segmented__option--active {
        background: var(--tui-background-base);
        color: var(--tui-text-primary);
        box-shadow: var(--tui-shadow-small);
      }

      /* ── Animacje ──────────────────────────────────────────────────── */

      @keyframes brand-drift-a {
        from {
          transform: translate3d(0, 0, 0) scale(1);
        }
        to {
          transform: translate3d(6rem, 4rem, 0) scale(1.15);
        }
      }

      @keyframes brand-drift-b {
        from {
          transform: translate3d(0, 0, 0) scale(1.1);
        }
        to {
          transform: translate3d(-5rem, -3rem, 0) scale(0.95);
        }
      }

      @keyframes alert-enter {
        from {
          opacity: 0;
          transform: translateY(-0.375rem);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }

      /* ── Responsywność ─────────────────────────────────────────────── */

      @media (max-width: 63.99rem) {
        .login {
          grid-template-columns: 1fr;
          grid-template-rows: auto 1fr;
        }

        .brand__content {
          gap: 1.25rem;
          max-inline-size: none;
          padding: 2.5rem 1.5rem;
        }

        .brand__description,
        .brand__modules,
        .brand__copyright {
          display: none;
        }

        .brand__tagline {
          font: var(--tui-typography-heading-h5);
        }

        .panel {
          padding: 2rem 1.25rem 3rem;
        }

        .card {
          border: none;
          box-shadow: none;
          padding-inline: 0;
        }

        .card::before {
          display: none;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .brand__aurora {
          animation: none;
        }

        .brand__content,
        .brand__mark,
        .brand__module,
        .card,
        .alert {
          transition: none;
          animation: none;
          transform: none;
        }
      }
    `,
  ],
})
export class LoginComponent {
  private readonly _authService = inject(ErpAuthService);
  private readonly _languageService = inject(ErpLanguageService);
  private readonly _themeService = inject(ErpThemeService);

  protected readonly AUTH_KEYS = AUTH_KEYS;
  protected readonly currentYear = new Date().getFullYear();

  protected readonly moduleKeys = [
    AUTH_KEYS.brand.modules.inventory,
    AUTH_KEYS.brand.modules.sales,
    AUTH_KEYS.brand.modules.catalog,
    AUTH_KEYS.brand.modules.dms,
    AUTH_KEYS.brand.modules.tasks,
    AUTH_KEYS.brand.modules.notifications,
  ];

  protected readonly languageOptions: ReadonlyArray<{ value: AppLanguage; label: string }> = [
    { value: 'pl-PL', label: 'PL' },
    { value: 'en-US', label: 'EN' },
  ];

  /** Zawsze `false` w praktyce — przekierowanie do Keycloaka opuszcza tę stronę natychmiast,
   * ale `erp-button` wymaga sygnału dla stanu `loading`, a krótki spinner jest lepszy niż
   * martwy przycisk w tej ułamkowej chwili między kliknięciem a nawigacją. */
  protected readonly isSubmitting = signal(false);
  protected readonly isLeaving = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected readonly language = this._languageService.language;
  protected readonly isDarkMode = this._themeService.isDarkMode;

  protected readonly submitConfig = new ErpButtonBuilder()
    .setLabel(AUTH_KEYS.login.submit)
    .setSize('l')
    .setAppearance('primary')
    .setIconEnd('@tui.arrow-right')
    .setLoading(this.isSubmitting)
    .setFn(() => this.signIn())
    .build();

  /** Przekierowuje do hostowanej strony logowania Keycloaka — hasło nigdy nie dotyka tej
   * strony (Authorization Code + PKCE, patrz `docs/backend/identity-authz.md` §1). */
  protected signIn(): void {
    this.errorKey.set(null);
    this.isSubmitting.set(true);
    this._authService.login();
  }

  protected setLanguage(language: AppLanguage): void {
    this._languageService.setLanguage(language);
  }

  protected toggleTheme(): void {
    this._themeService.toggleTheme();
  }
}
