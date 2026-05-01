import { Directive, input, effect, OnDestroy, ViewContainerRef, ComponentRef, Type, inject } from '@angular/core';
import { Subscription } from 'rxjs';

@Directive({
  selector: '[erpDynamicOutlet]',
  standalone: true,
})
export class ErpDynamicOutletDirective implements OnDestroy {
  public component = input.required<Type<any>>();
  public inputs = input<Record<string, any>>();
  public outputs = input<Record<string, (event: any) => void>>();

  private _componentRef?: ComponentRef<any>;
  private _subscriptions: Subscription[] = [];

  private _vcr = inject(ViewContainerRef);

  public constructor() {
    // Reagujemy na zmianę typu komponentu - musimy go stworzyć na nowo
    effect(() => {
      const type = this.component();
      this._vcr.clear();
      this._componentRef = this._vcr.createComponent(type);
      this._syncInputs();
      this._syncOutputs();
    });

    // Reagujemy na zmianę samych danych wejściowych - używamy setInput by nie niszczyć komponentu
    effect(() => {
      this._syncInputs();
    });

    // Reagujemy na zmianę wyjść (eventów)
    effect(() => {
      this._syncOutputs();
    });
  }

  private _syncInputs(): void {
    const data = this.inputs();
    if (!this._componentRef || !data) return;

    Object.entries(data).forEach(([key, value]) => {
      this._componentRef?.setInput(key, value);
    });
  }

  private _syncOutputs(): void {
    const data = this.outputs();
    if (!this._componentRef || !data) return;

    // Czyścimy stare subskrypcje
    this._subscriptions.forEach((sub) => sub.unsubscribe());
    this._subscriptions = [];

    Object.entries(data).forEach(([eventName, callback]) => {
      const outputProperty = this._componentRef?.instance[eventName];
      if (outputProperty && typeof outputProperty.subscribe === 'function') {
        const sub = outputProperty.subscribe(callback);
        this._subscriptions.push(sub);
      }
    });
  }

  public ngOnDestroy(): void {
    this._subscriptions.forEach((sub) => sub.unsubscribe());
    this._componentRef?.destroy();
  }
}
