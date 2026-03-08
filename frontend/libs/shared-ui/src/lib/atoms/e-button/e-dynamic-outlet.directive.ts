import { Directive, Input, OnInit, OnDestroy, ViewContainerRef, ComponentRef, Type, inject } from '@angular/core';
import { Subscription } from 'rxjs';

@Directive({
  selector: '[eDynamicOutlet]',
  standalone: true,
})
export class EDynamicOutletDirective implements OnInit, OnDestroy {
  @Input() public component!: Type<any>;
  @Input() public inputs?: Record<string, any>;
  @Input() public outputs?: Record<string, (event: any) => void>;

  private _componentRef?: ComponentRef<any>;
  private _subscriptions: Subscription[] = [];

  private _vcr = inject(ViewContainerRef);

  public ngOnInit(): void {
    // 1. Ręcznie tworzymy komponent w miejscu użycia dyrektywy
    this._componentRef = this._vcr.createComponent(this.component);

    // 2. Wstrzykujemy Inputs (Angular 14+ ma do tego gotową metodę setInput)
    if (this.inputs) {
      Object.entries(this.inputs).forEach(([key, value]) => {
        this._componentRef?.setInput(key, value);
      });
    }

    // 3. MAGIA: Podpinamy Outputs!
    if (this.outputs) {
      Object.entries(this.outputs).forEach(([eventName, callback]) => {
        // Dobieramy się do instancji (np. public onClick = output() w EButton)
        const outputProperty = this._componentRef?.instance[eventName];

        // Jeśli to faktycznie zdarzenie (Observable lub nowe output()), subskrybujemy je
        if (outputProperty && typeof outputProperty.subscribe === 'function') {
          const sub = outputProperty.subscribe(callback);
          this._subscriptions.push(sub);
        }
      });
    }
  }

  public ngOnDestroy(): void {
    // Pamiętamy o sprzątaniu, by uniknąć wycieków pamięci!
    this._subscriptions.forEach((sub) => sub.unsubscribe());
    this._componentRef?.destroy();
  }
}
