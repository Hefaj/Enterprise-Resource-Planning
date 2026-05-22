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
import { TagModule } from 'primeng/tag';

export interface EditEanDialogData {
  products: { uuid: string; sku: string; ean?: string }[];
  onSave: (uuid: string, ean: string) => Promise<void>;
}

/**
 * Modal edycji kodu EAN produktu.
 * Otwierany przez DialogService. Obsługuje edycję jednego lub wielu produktów.
 */
@Component({
  selector: 'catalog-edit-ean-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonModule, InputTextModule, TagModule],
  template: `
    @let _products = products();
    @let _saving = saving();
    @let _error = error();

    <div class="edit-ean-modal">
      <div class="modal-description">
        <p class="text-surface-600 dark:text-surface-400 text-sm mb-4">
          Edytujesz kod EAN dla
          <strong>{{ _products.length }}</strong>
          {{ _products.length === 1 ? 'produktu' : 'produktów' }}:
        </p>

        <!-- Lista zaznaczonych produktów -->
        <div class="selected-products mb-4">
          @for (p of _products; track p.uuid) {
            <div class="product-badge">
              <i class="pi pi-box text-xs"></i>
              <span>{{ p.sku }}</span>
            </div>
          }
        </div>
      </div>

      <!-- Formularz -->
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-4">
        <div class="field">
          <label for="ean-input" class="field-label">
            Kod EAN
            <span class="required-mark">*</span>
          </label>
          <input
            id="ean-input"
            pInputText
            formControlName="ean"
            placeholder="np. 5901234123457"
            class="w-full font-mono"
            [class.p-invalid]="form.controls.ean.invalid && form.controls.ean.touched"
            autocomplete="off"
          />
          @if (form.controls.ean.invalid && form.controls.ean.touched) {
            <small class="field-error">
              @if (form.controls.ean.errors?.['required']) {
                Kod EAN jest wymagany
              } @else if (form.controls.ean.errors?.['pattern']) {
                Kod EAN musi zawierać 8, 12 lub 13 cyfr
              }
            </small>
          }
          <small class="field-hint">Format: EAN-8, EAN-12 lub EAN-13</small>
        </div>

        @if (_error) {
          <div class="error-banner">
            <i class="pi pi-exclamation-triangle"></i>
            <span>{{ _error }}</span>
          </div>
        }

        <!-- Footer -->
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
            label="Zapisz EAN"
            [loading]="_saving"
            [disabled]="form.invalid || _saving"
            icon="pi pi-save"
          ></button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .edit-ean-modal {
      padding: 0.25rem 0;
      min-width: 380px;
    }
    .selected-products {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .product-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.2rem 0.6rem;
      border-radius: 1rem;
      background: var(--p-surface-100);
      color: var(--p-surface-700);
      font-size: 0.8rem;
      font-weight: 500;
      border: 1px solid var(--p-surface-200);
    }
    :host-context(.dark) .product-badge,
    :host-context([data-theme="dark"]) .product-badge {
      background: var(--p-surface-800);
      color: var(--p-surface-200);
      border-color: var(--p-surface-700);
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .field-label {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--p-surface-700);
    }
    :host-context(.dark) .field-label,
    :host-context([data-theme="dark"]) .field-label {
      color: var(--p-surface-300);
    }
    .required-mark {
      color: var(--p-red-500);
      margin-left: 2px;
    }
    .field-error {
      color: var(--p-red-500);
      font-size: 0.75rem;
    }
    .field-hint {
      color: var(--p-surface-400);
      font-size: 0.75rem;
    }
    .error-banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: var(--p-red-50);
      border: 1px solid var(--p-red-200);
      border-radius: 0.5rem;
      color: var(--p-red-700);
      font-size: 0.875rem;
    }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--p-surface-100);
    }
    :host-context(.dark) .modal-footer,
    :host-context([data-theme="dark"]) .modal-footer {
      border-color: var(--p-surface-800);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditEanModalComponent {
  private dialogRef = inject(DynamicDialogRef);
  private dialogConfig = inject(DynamicDialogConfig);

  protected saving = signal(false);
  protected error = signal<string | null>(null);

  protected products = computed<EditEanDialogData['products']>(() =>
    this.dialogConfig?.data?.products ?? []
  );

  protected form = new FormGroup({
    ean: new FormControl('', [
      Validators.required,
      Validators.pattern(/^\d{8}$|^\d{12}$|^\d{13}$/),
    ]),
  });

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    this.saving.set(true);
    this.error.set(null);

    const ean = this.form.value.ean!;
    const onSave: EditEanDialogData['onSave'] = this.dialogConfig?.data?.onSave;

    try {
      for (const product of this.products()) {
        if (onSave) {
          await onSave(product.uuid, ean);
        } else {
          // Mock – gdy brak callbacku (tryb deweloperski)
          await new Promise<void>((r) => setTimeout(r, 400));
          console.log(`[Mock] PATCH /product/${product.uuid}/ean →`, { ean });
        }
      }
      this.dialogRef?.close({ success: true, ean });
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
