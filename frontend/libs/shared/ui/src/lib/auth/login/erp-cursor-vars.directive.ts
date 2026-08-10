import { afterNextRender, DestroyRef, Directive, ElementRef, inject } from '@angular/core';

/**
 * Publikuje pozycję kursora jako zmienne CSS na hoście, dzięki czemu efekty
 * reagujące na mysz są czystym CSS-em i nie uruchamiają Change Detection.
 *
 * Udostępniane zmienne (dziedziczone przez wszystkich potomków):
 * - `--cursor-x` / `--cursor-y`   — pozycja w px względem lewego górnego rogu hosta,
 * - `--cursor-nx` / `--cursor-ny` — pozycja znormalizowana do zakresu -1..1 (środek = 0),
 * - `--cursor-inside`            — 1 gdy kursor jest nad hostem, 0 gdy poza nim.
 */
@Directive({
  selector: '[erpCursorVars]',
  standalone: true,
})
export class ErpCursorVarsDirective {
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _destroyRef = inject(DestroyRef);

  private _clientX = 0;
  private _clientY = 0;
  private _frame = 0;

  public constructor() {
    afterNextRender(() => this._bind());
  }

  private _bind(): void {
    const onPointerMove = (event: PointerEvent): void => {
      this._clientX = event.clientX;
      this._clientY = event.clientY;

      if (this._frame) {
        return;
      }

      this._frame = requestAnimationFrame(() => {
        this._frame = 0;
        this._publish();
      });
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });

    this._destroyRef.onDestroy(() => {
      window.removeEventListener('pointermove', onPointerMove);
      if (this._frame) {
        cancelAnimationFrame(this._frame);
      }
    });
  }

  private _publish(): void {
    const host = this._host.nativeElement;
    const rect = host.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return;
    }

    const x = this._clientX - rect.left;
    const y = this._clientY - rect.top;
    const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;

    host.style.setProperty('--cursor-x', `${x.toFixed(1)}px`);
    host.style.setProperty('--cursor-y', `${y.toFixed(1)}px`);
    host.style.setProperty('--cursor-nx', clampUnit((x / rect.width) * 2 - 1).toFixed(3));
    host.style.setProperty('--cursor-ny', clampUnit((y / rect.height) * 2 - 1).toFixed(3));
    host.style.setProperty('--cursor-inside', inside ? '1' : '0');
  }
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(-1, value));
}
