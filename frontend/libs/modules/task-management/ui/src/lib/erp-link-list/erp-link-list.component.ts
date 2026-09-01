import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  ErpButtonComponent,
  ErpButtonConfig,
  ErpInputBuilder,
  ErpInputComponent,
  ErpInputConfig,
  ErpInputPickerBuilder,
  ErpInputPickerComponent,
  ErpInputPickerConfig,
  ErpTranslatePipe,
  unwrapSignal,
} from '@erp/shared/ui';

import { ErpLinkListConfig } from './erp-link-list.types';
import { TASKMANAGEMENT_KEYS } from '../translation';

/**
 * Pasek powiązań — rodzic, podzadania, blokady, miejsce na przyszłe „zlecenie" z fazy 5
 * (`docs/frontend/task-management-pages.md` §10). Prezentacyjny — dodawanie/usuwanie tylko
 * emitują zdarzenia, komenda i rozwiązanie klucza→uuid zostają w `feature`
 * (`erp-task-management-issue-links`).
 */
@Component({
  selector: 'erp-link-list',
  standalone: true,
  imports: [ErpButtonComponent, ErpInputComponent, ErpInputPickerComponent, ErpTranslatePipe, ReactiveFormsModule, RouterLink],
  template: `
    <div class="erp-link-list">
      @let parent = this.parent();

      @if (parent) {
        <div class="erp-link-list__row">
          <span class="erp-link-list__label">{{ TASKMANAGEMENT_KEYS.links.parent | erpTranslate }}</span>
          <a class="erp-link-list__ref" [routerLink]="parent.link">{{ parent.key }}</a>
          <span class="erp-link-list__title">{{ parent.title }}</span>
          <erp-button [config]="this.detachParentButton" />
        </div>
      } @else {
        <div class="erp-link-list__row">
          <erp-input class="flex-1" [config]="this.parentInput" [formControl]="this.parentControl" />
          <erp-button [config]="this.setParentButton" />
        </div>
      }

      @if (this.children().length > 0) {
        <div class="erp-link-list__group">
          <span class="erp-link-list__label">{{ TASKMANAGEMENT_KEYS.links.children | erpTranslate }}</span>
          @for (child of this.children(); track child.uuid) {
            <div class="erp-link-list__row erp-link-list__row--indent">
              <a class="erp-link-list__ref" [routerLink]="child.link">{{ child.key }}</a>
              <span class="erp-link-list__title">{{ child.title }}</span>
              @if (child.stateNameKey) {
                <span class="erp-link-list__state">{{ child.stateNameKey | erpTranslate }}</span>
              }
            </div>
          }
        </div>
      }

      @for (link of this.links(); track link.uuid) {
        <div class="erp-link-list__row">
          <span class="erp-link-list__label">{{ link.relationKey | erpTranslate }}</span>
          <a class="erp-link-list__ref" [routerLink]="link.link">{{ link.key }}</a>
          <span class="erp-link-list__title">{{ link.title }}</span>
          @if (link.removable !== false) {
            <erp-button [config]="this.removeButton(link.uuid)" />
          }
        </div>
      }

      @if (!parent && this.children().length === 0 && this.links().length === 0) {
        <span class="erp-link-list__empty">{{ TASKMANAGEMENT_KEYS.links.none | erpTranslate }}</span>
      }

      <div class="erp-link-list__row">
        <erp-input-picker class="w-40" [config]="this.typePickerConfig()" [control]="this.typeControl" />
        <erp-input class="flex-1" [config]="this.targetInput" [formControl]="this.targetControl" />
        <erp-button [config]="this.addButton" />
      </div>

      @if (this.error()) {
        <span class="erp-link-list__error">{{ this.error()! | erpTranslate }}</span>
      }
    </div>
  `,
  styles: [
    `
      .erp-link-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .erp-link-list__group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .erp-link-list__row {
        display: flex;
        /* flex-end, nie baseline — w wierszu z polami formularza (typ + klucz + dodaj)
           erp-input-picker ma etykietę nad polem, a erp-input obok nie (sam placeholder),
           więc wyrównanie po linii bazowej tekstu wypychało pola na różne wysokości. Dla
           wierszy z samym tekstem (klucz, tytuł) różnica względem baseline jest niezauważalna
           przy jednej linii tekstu o tej samej wysokości. */
        align-items: flex-end;
        gap: 0.5rem;
        font-size: 0.875rem;
      }

      .erp-link-list__row--indent {
        padding-left: 0.75rem;
      }

      .erp-link-list__label {
        color: var(--tui-text-tertiary);
        font-size: 0.75rem;
        text-transform: uppercase;
      }

      .erp-link-list__ref {
        font-family: var(--tui-font-mono, monospace);
        font-size: 0.75rem;
      }

      .erp-link-list__title {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .erp-link-list__state {
        font-size: 0.75rem;
        color: var(--tui-text-tertiary);
      }

      .erp-link-list__empty {
        font-size: 0.875rem;
        color: var(--tui-text-secondary);
      }

      .erp-link-list__error {
        font-size: 0.75rem;
        color: var(--tui-status-negative);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpLinkListComponent {
  protected readonly TASKMANAGEMENT_KEYS = TASKMANAGEMENT_KEYS;

  public readonly config = input.required<ErpLinkListConfig>();

  /** Ustawia rodzica po kluczu czytelnym wpisanym w polu. */
  public readonly setParent = output<string>();

  public readonly detachParent = output<void>();

  public readonly addLink = output<{ targetKey: string; type: number }>();

  public readonly removeLink = output<string>();

  protected readonly parent = computed(() => unwrapSignal(this.config().parent));
  protected readonly children = computed(() => unwrapSignal(this.config().children) ?? []);
  protected readonly links = computed(() => unwrapSignal(this.config().links) ?? []);
  protected readonly linkTypeOptions = computed(() => unwrapSignal(this.config().linkTypeOptions) ?? []);
  protected readonly saving = computed(() => unwrapSignal(this.config().saving) ?? false);
  protected readonly error = computed(() => unwrapSignal(this.config().error));

  protected readonly parentControl = new FormControl<string | null>(null);
  protected readonly targetControl = new FormControl<string | null>(null);
  protected readonly typeControl = new FormControl<number | null>(null);

  protected readonly parentInput: ErpInputConfig = ErpInputBuilder.create((b) =>
    b.setLabel(TASKMANAGEMENT_KEYS.links.parent).setPlaceholder(TASKMANAGEMENT_KEYS.links.parentPlaceholder),
  );

  protected readonly targetInput: ErpInputConfig = ErpInputBuilder.create((b) =>
    b.setPlaceholder(TASKMANAGEMENT_KEYS.links.targetPlaceholder),
  );

  protected readonly typePickerConfig = computed<ErpInputPickerConfig>(() =>
    ErpInputPickerBuilder.create((b) =>
      b
        .setLabel(TASKMANAGEMENT_KEYS.links.type)
        .setItems(this.linkTypeOptions())
        .setLabelKey('label')
        .setValueKey('value')
        .setStrategy('single'),
    ),
  );

  protected readonly setParentButton: ErpButtonConfig = {
    label: TASKMANAGEMENT_KEYS.links.setParentSubmit,
    appearance: 'secondary',
    size: 'm',
    loading: this.saving,
    fn: (): void => {
      const key = this.parentControl.value?.trim();
      if (key) {
        this.setParent.emit(key);
        this.parentControl.reset();
      }
    },
  };

  protected readonly detachParentButton: ErpButtonConfig = {
    label: TASKMANAGEMENT_KEYS.links.detachParent,
    appearance: 'flat',
    size: 's',
    fn: (): void => this.detachParent.emit(),
  };

  protected readonly addButton: ErpButtonConfig = {
    label: TASKMANAGEMENT_KEYS.links.addSubmit,
    appearance: 'secondary',
    size: 'm',
    loading: this.saving,
    fn: (): void => {
      const key = this.targetControl.value?.trim();
      const type = this.typeControl.value;

      if (key && type !== null && type !== undefined) {
        this.addLink.emit({ targetKey: key, type });
        this.targetControl.reset();
      }
    },
  };

  protected removeButton(uuid: string): ErpButtonConfig {
    return {
      label: TASKMANAGEMENT_KEYS.links.remove,
      appearance: 'flat',
      size: 's',
      fn: (): void => this.removeLink.emit(uuid),
    };
  }
}
