import { Directive, input, computed } from '@angular/core';
import { FormControl } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Directive()
export abstract class ErpBaseListComponent<TItem> {
  public readonly selectionMode = input<'single' | 'multiple' | 'none'>('none');
  public readonly readonly = input<boolean>(false);
  public readonly onSelection = input<(val: any) => void>();

  protected readonly control = new FormControl();

  constructor() {
    this.control.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((val) => {
        const callback = this.onSelection();
        if (callback) {
          callback(val);
        }
        if (this.selectionMode() === 'none' && val !== null) {
          this.control.setValue(null, { emitEvent: false });
        }
      });
  }
}
