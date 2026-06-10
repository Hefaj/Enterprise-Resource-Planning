import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';

export interface EditSkuDialogData {
  products: { uuid: string; sku: string }[];
  onSave: (uuid: string, sku: string) => Promise<void>;
}

/**
 * Modal edycji kodu SKU produktu.
 * Obsługuje edycję jednego lub wielu produktów jednocześnie.
 */
@Component({
  selector: 'catalog-edit-sku-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonModule, InputTextModule],
  template: `
    @let _products = products();
    @let _saving = saving();
    @let _error = error();

    <div class="edit-sku-modal">
      <p class="text-surface-600 dark:text-surface-400 text-sm mb-4">
        Edytujesz kod SKU dla
        <strong>{{ _products.length }}</strong>
        {{ _products.length === 1 ? 'produktu' : 'produktów' }}:
      </p>

      <div class="selected-products mb-4">
        @for (p of _products; track p.uuid) {
          <div class="product-badge">
            <i class="pi pi-tag text-xs"></i>
            <span>{{ p.sku }}</span>
          </div>
        }
      </div>

      @if (_products.length > 1) {
        <div class="warning-banner mb-4">
          <i class="pi pi-info-circle"></i>
          <span>
            Przy edycji wielu produktów jednocześnie nowy SKU zostanie nadany każdemu
            z osobną numeracją sufiksową (np. SKU-1, SKU-2).
          </span>
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-4">
        <div class="field">
          <label for="sku-input" class="field-label">
            Nowy kod SKU
            <span class="required-mark">*</span>
          </label>
          <input
            id="sku-input"
            pInputText
            formControlName="sku"
            placeholder="np. ELE-001"
            class="w-full font-mono uppercase"
            [class.p-invalid]="form.controls.sku.invalid && form.controls.sku.touched"
            autocomplete="off"
          />
          @if (form.controls.sku.invalid && form.controls.sku.touched) {
            <small class="field-error">
              @if (form.controls.sku.errors?.['required']) {
                Kod SKU jest wymagany
              } @else if (form.controls.sku.errors?.['minlength']) {
                SKU musi mieć co najmniej 3 znaki
              } @else if (form.controls.sku.errors?.['maxlength']) {
                SKU może mieć maksymalnie 50 znaków
              } @else if (form.controls.sku.errors?.['pattern']) {
                SKU może zawierać tylko litery, cyfry, myślniki i podkreślniki
              }
            </small>
          }
        </div>

        @if (_error) {
          <div class="error-banner">
            <i class="pi pi-exclamation-triangle"></i>
            <span>{{ _error }}</span>
          </div>
        }

        <div class="modal-footer">
          <button
            pButton
            type="button"
            label="Anuluj"
            severity="secondary"
            [text]="true"
            (click)="onCancel()"
            [disabled]="_saving"
          ></button>
          <button
            pButton
            type="submit"
            label="Zapisz SKU"
            [loading]="_saving"
            [disabled]="form.invalid || _saving"
            icon="pi pi-save"
          ></button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .edit-sku-modal { padding: 0.25rem 0; min-width: 380px; }
    .selected-products { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .product-badge {
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.2rem 0.6rem; border-radius: 1rem;
      background: var(--p-surface-100); color: var(--p-surface-700);
      font-size: 0.8rem; font-weight: 500; border: 1px solid var(--p-surface-200);
    }
    :host-context(.dark) .product-badge,
    :host-context([data-theme="dark"]) .product-badge {
      background: var(--p-surface-800); color: var(--p-surface-200); border-color: var(--p-surface-700);
    }
    .warning-banner {
      display: flex; align-items: flex-start; gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: var(--p-amber-50); border: 1px solid var(--p-amber-200);
      border-radius: 0.5rem; color: var(--p-amber-700); font-size: 0.8rem;
    }
    .error-banner {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.75rem 1rem; background: var(--p-red-50);
      border: 1px solid var(--p-red-200); border-radius: 0.5rem;
      color: var(--p-red-700); font-size: 0.875rem;
    }
    .field { display: flex; flex-direction: column; gap: 0.4rem; }
    .field-label { font-size: 0.875rem; font-weight: 600; color: var(--p-surface-700); }
    :host-context(.dark) .field-label,
    :host-context([data-theme="dark"]) .field-label { color: var(--p-surface-300); }
    .required-mark { color: var(--p-red-500); margin-left: 2px; }
    .field-error { color: var(--p-red-500); font-size: 0.75rem; }
    .modal-footer {
      display: flex; justify-content: flex-end; gap: 0.75rem;
      padding-top: 0.5rem; border-top: 1px solid var(--p-surface-100);
    }
    :host-context(.dark) .modal-footer,
    :host-context([data-theme="dark"]) .modal-footer { border-color: var(--p-surface-800); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditSkuModalComponent {
  private dialogRef = inject(DynamicDialogRef);
  private dialogConfig = inject(DynamicDialogConfig);

  protected saving = signal(false);
  protected error = signal<string | null>(null);

  protected products = computed<EditSkuDialogData['products']>(() =>
    this.dialogConfig?.data?.products ?? []
  );

  protected form = new FormGroup({
    sku: new FormControl('', [
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(50),
      Validators.pattern(/^[A-Za-z0-9_-]+$/),
    ]),
  });

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    this.saving.set(true);
    this.error.set(null);

    const baseSku = this.form.value.sku!.toUpperCase();
    const onSave: EditSkuDialogData['onSave'] = this.dialogConfig?.data?.onSave;
    const prods = this.products();

    try {
      for (let i = 0; i < prods.length; i++) {
        const sku = prods.length === 1 ? baseSku : `${baseSku}-${i + 1}`;
        if (onSave) {
          await onSave(prods[i].uuid, sku);
        } else {
          await new Promise<void>((r) => setTimeout(r, 300));
          console.log(`[Mock] PATCH /product/${prods[i].uuid}/sku →`, { sku });
        }
      }
      this.dialogRef?.close({ success: true });
    } catch (e: any) {
      this.error.set(e?.message || 'Wystąpił błąd podczas zapisu.');
    } finally {
      this.saving.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef?.close({ success: false });
  }
}
