import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ErpToastRequest {
  message: string;
  appearance: 'warning' | 'negative' | 'positive' | 'info';
}

/**
 * Most między kodem, który nie ma dostępu do `TuiAlertService` (np. funkcyjny
 * `HttpInterceptorFn` — działa w root `EnvironmentInjector`, a `TuiAlertService` jest
 * dostarczany dopiero na poziomie komponentu `<tui-root>`, patrz `NG0201` przy próbie
 * bezpośredniego `inject()` w interceptorze), a `ErpToastBridgeComponent`, który żyje
 * jako potomek `<tui-root>` w `app.html` i faktycznie otwiera alert.
 */
@Injectable({ providedIn: 'root' })
export class ErpToastBridgeService {
  private readonly _requests$ = new Subject<ErpToastRequest>();
  public readonly requests$ = this._requests$.asObservable();

  public show(message: string, appearance: ErpToastRequest['appearance'] = 'warning'): void {
    this._requests$.next({ message, appearance });
  }
}
