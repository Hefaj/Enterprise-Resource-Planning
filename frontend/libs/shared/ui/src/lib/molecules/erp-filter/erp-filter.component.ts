import { Component, input, output, computed, OnInit, effect, signal, untracked, inject, DestroyRef } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { TuiButton, TuiDataList, TuiDropdown, TuiExpand, TuiHint, TuiIcon } from '@taiga-ui/core';
import { TuiButtonLoading } from '@taiga-ui/kit';
import { ErpFilterConfig, ErpFilterGroup } from './erp-filter.types';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { SHARED_KEYS } from '../../translation/keys';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'erp-filter',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TuiExpand,
    TuiDataList,
    TuiDropdown,
    TuiHint,
    TuiIcon,
    TuiButton,
    TuiButtonLoading,
    ErpTranslatePipe,
    NgComponentOutlet
  ],
  template: `
    <div class="erp-filter flex flex-col gap-3 px-2" [class]="rootStyleClass()">
      
      <!-- Top actions Toolbar (Clean, no card) -->
      <div class="flex justify-between items-center px-2 pt-3 mb-1">
        <div class="flex items-center gap-2">
          <tui-icon icon="@tui.filter" class="text-[var(--tui-text-secondary)] text-lg"></tui-icon>
          <span class="font-semibold text-lg text-[var(--tui-text-primary)]">Filtry</span>
        </div>
        
        <div class="flex gap-1 items-center">
          <button tuiIconButton type="button" appearance="flat" size="s" (click)="clearAll()" [disabled]="isClearAllDisabled()" [tuiHint]="SHARED_KEYS.filters.clear | erpTranslate">
            <tui-icon icon="@tui.trash-2"></tui-icon>
          </button>
          
          <div class="w-px h-5 bg-[var(--tui-border-normal)] mx-1"></div>
          
          <button tuiIconButton type="button" appearance="flat" size="s" [tuiDropdown]="saveDropdown" [tuiDropdownOpen]="saveDropdownOpen()" (tuiDropdownOpenChange)="saveDropdownOpen.set($event)" [disabled]="isClearAllDisabled()" [tuiHint]="SHARED_KEYS.filters.savePreset | erpTranslate">
            <tui-icon icon="@tui.download"></tui-icon>
          </button>
          
          <ng-template #saveDropdown>
            <div class="p-3 flex flex-col gap-2 bg-[var(--tui-background-elevation-1)] rounded-md shadow-lg border border-[var(--tui-border-normal)] w-[260px]">
               <span class="text-sm font-semibold">Zapisz jako</span>
               @if (existingPresetNameWithSameFilters(); as existingName) {
                 <div class="text-[0.75rem] leading-tight text-orange-500 bg-orange-500/10 p-2 rounded border border-orange-500/20">
                   {{ SHARED_KEYS.filters.presetOverwriteWarning | erpTranslate: { name: existingName } }}
                 </div>
               }
               <div class="flex gap-2">
                  <input type="text" [formControl]="savePresetName" class="px-2 py-1 text-sm border border-[var(--tui-border-normal)] rounded-md bg-[var(--tui-background-base)] text-[var(--tui-text-primary)] min-w-[150px] outline-none focus:border-blue-500 transition-colors" placeholder="Nazwa..." (keydown.enter)="confirmSave()" />
                  <button tuiIconButton type="button" appearance="primary" size="s" (click)="confirmSave()" [disabled]="savePresetName.invalid">
                     <tui-icon icon="@tui.check"></tui-icon>
                  </button>
               </div>
            </div>
          </ng-template>
          
          <button tuiIconButton type="button" appearance="flat" size="s" [tuiDropdown]="loadDropdown" [tuiDropdownOpen]="loadDropdownOpen()" (tuiDropdownOpenChange)="loadDropdownOpen.set($event)" [disabled]="presetKeys().length === 0" [tuiHint]="SHARED_KEYS.filters.loadPreset | erpTranslate">
            <tui-icon icon="@tui.upload"></tui-icon>
          </button>

          <ng-template #loadDropdown>
            <tui-data-list class="min-w-[200px]">
              @for (presetName of presetKeys(); track presetName) {
                <div tuiOption class="flex justify-between items-center w-full group !p-1 !pl-3 cursor-pointer">
                  <span class="truncate flex-1 py-1" (click)="confirmLoad(presetName)">{{ presetName }}</span>
                  <button tuiIconButton type="button" appearance="flat" size="s" class="opacity-0 group-hover:opacity-100 transition-opacity" (click)="deletePreset(presetName, $event)">
                    <tui-icon icon="@tui.trash-2" class="text-red-500"></tui-icon>
                  </button>
                </div>
              }
            </tui-data-list>
          </ng-template>
        </div>
      </div>

      <!-- Root Fields (No Group) -->
      @if (config().fields && config().fields!.length > 0) {
        <div class="px-3 pb-3 pt-3 grid gap-3 bg-[var(--tui-background-elevation-1)] rounded-xl border border-[var(--tui-border-normal)] shadow-sm mb-3" 
             style="grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr));">
          @for (field of config().fields; track field.key) {
            <div [class]="unwrap(field.styleClass)" [style.grid-column]="(unwrap(field.colSpan) || 1) > 1 ? 'span ' + unwrap(field.colSpan) : 'auto'">
              <ng-container *ngComponentOutlet="field.component; inputs: { config: field.config, control: getControl(field.key) }"></ng-container>
            </div>
          }
        </div>
      }

      <!-- Filter Groups (Unified Accordion) -->
      @if (groups() && groups().length > 0) {
        <div class="flex flex-col rounded-xl border border-[var(--tui-border-normal)] bg-[var(--tui-background-elevation-1)] shadow-sm overflow-hidden">
          @for (group of groups(); track group.key; let last = $last) {
            <div class="flex flex-col" [class.border-b]="!last" style="border-color: var(--tui-border-normal);">
              
              <!-- Group Header -->
              <div class="flex justify-between items-center w-full px-3 py-2 cursor-pointer transition-colors hover:bg-[var(--tui-background-neutral-1)]" 
                   (click)="toggleGroup(group.key)">
                <span class="text-[0.95rem] font-medium tracking-wide select-none text-[var(--tui-text-primary)] truncate pr-2">
                  {{ (unwrap(group.title) | erpTranslate) || group.key }}
                </span>
                <div class="flex items-center gap-1 shrink-0">
                  <button tuiIconButton type="button" appearance="flat" size="s" [disabled]="groupEmptyState()[group.key]" (click)="clearGroup(group.key, $event)" [tuiHint]="SHARED_KEYS.filters.clearGroup | erpTranslate">
                    <tui-icon icon="@tui.x"></tui-icon>
                  </button>
                  <div class="flex items-center justify-center w-8 h-8 rounded-full transition-colors hover:bg-[var(--tui-background-neutral-2)]">
                    <tui-icon icon="@tui.chevron-down" 
                              class="text-[var(--tui-text-secondary)] transition-transform duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]" 
                              [class.rotate-180]="isExpanded(group.key)"></tui-icon>
                  </div>
                </div>
              </div>
              
              <!-- Group Content -->
              <tui-expand [expanded]="isExpanded(group.key)">
                <div class="px-3 pb-3 pt-3 grid gap-3 bg-[var(--tui-background-elevation-1)]" 
                     [class]="unwrap(group.styleClass)" 
                     style="grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr));">
                  @for (field of group.fields; track field.key) {
                    <div [class]="unwrap(field.styleClass)" [style.grid-column]="(unwrap(field.colSpan) || 1) > 1 ? 'span ' + unwrap(field.colSpan) : 'auto'">
                      <ng-container *ngComponentOutlet="field.component; inputs: { config: field.config, control: getControl(field.key) }"></ng-container>
                    </div>
                  }
                </div>
              </tui-expand>
            </div>
          }
        </div>
      }

      <!-- Bottom actions -->
      <div class="mt-2 relative group">
        <div class="absolute -inset-1 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-xl blur opacity-100 transition duration-300"></div>
        <button tuiButton type="button" appearance="primary" size="l" class="w-full relative z-10" iconStart="@tui.search" (click)="onSearch()" [loading]="isLoading()" [disabled]="isLoading()">
          {{ SHARED_KEYS.filters.search | erpTranslate }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `]
})
export class ErpFilterComponent implements OnInit {
  public readonly config = input.required<ErpFilterConfig>();
  public readonly savedPresets = input<Record<string, any>>({});
  
  public readonly search = output<any>();
  public readonly savePresetEvent = output<{name: string, value: any}>();
  public readonly loadPresetEvent = output<string>();
  public readonly deletePresetEvent = output<string>();

  public readonly rootStyleClass = computed(() => unwrapSignal(this.config().styleClass) || '');
  public readonly groups = computed(() => this.config().groups);
  public readonly presetKeys = computed(() => Object.keys(this.savedPresets() || {}));
  
  public readonly savePresetName = new FormControl('', Validators.required);
  public readonly saveDropdownOpen = signal(false);
  public readonly loadDropdownOpen = signal(false);
  public readonly isClearAllDisabled = signal(true);
  public readonly isLoading = computed(() => unwrapSignal(this.config().isLoading) || false);
  public readonly groupEmptyState = signal<Record<string, boolean>>({});
  public readonly currentFormValue = signal<any>({});

  public readonly existingPresetNameWithSameFilters = computed(() => {
    const currentVal = this.currentFormValue();
    const presets = this.savedPresets();
    if (!presets || Object.keys(presets).length === 0) return null;

    const normalize = (obj: any) => {
      if (!obj) return '{}';
      const res: any = {};
      for (const k in obj) {
        const v = obj[k];
        if (v !== null && v !== undefined && v !== '') {
          if (Array.isArray(v) && v.length === 0) continue;
          if (v === false) continue;
          res[k] = v;
        }
      }
      return JSON.stringify(res, Object.keys(res).sort());
    };

    const currentNormalized = normalize(currentVal);
    if (currentNormalized === '{}') return null;

    for (const [name, value] of Object.entries(presets)) {
      if (normalize(value) === currentNormalized) {
        return name;
      }
    }
    return null;
  });

  private readonly expandedState = signal<Record<string, boolean>>({});
  private readonly destroyRef = inject(DestroyRef);

  public readonly SHARED_KEYS = SHARED_KEYS;

  constructor() {
    effect(() => {
      const autoSearch = unwrapSignal(this.config().autoSearch);
      if (autoSearch) {
        untracked(() => {
          this.config().formGroup.valueChanges.pipe(
            debounceTime(300),
            takeUntilDestroyed()
          ).subscribe(val => {
            if (this.config().formGroup.valid) {
              this.search.emit(val);
              this.config().onSearch?.(val);
            }
          });
        });
      }
    });
  }

  public ngOnInit(): void {
    // Initial loading is handled by the parent component
    this.initExpandedState();
    
    this.updateEmptyStates(this.config().formGroup.value);
    
    this.config().formGroup.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(val => {
      this.updateEmptyStates(val);
    });
  }

  private updateEmptyStates(val: any): void {
    this.currentFormValue.set(val);
    this.isClearAllDisabled.set(this.checkIfEmpty(val));
    
    const groupStates: Record<string, boolean> = {};
    for (const group of this.groups()) {
      groupStates[group.key] = this.checkIfGroupEmpty(group, val);
    }
    this.groupEmptyState.set(groupStates);
  }

  private checkIfGroupEmpty(group: ErpFilterGroup, formValue: any): boolean {
    if (!formValue) return true;
    for (const field of group.fields) {
      const v = formValue[field.key];
      if (v !== null && v !== undefined && v !== '') {
        if (Array.isArray(v) && v.length === 0) continue;
        if (v === false) continue; // traktujemy domyślne switche (false) jako puste
        return false;
      }
    }
    return true;
  }

  private checkIfEmpty(val: any): boolean {
    if (!val) return true;
    for (const key of Object.keys(val)) {
      const v = val[key];
      if (v !== null && v !== undefined && v !== '') {
        if (Array.isArray(v) && v.length === 0) continue;
        if (v === false) continue; // traktujemy domyślne switche (false) jako puste
        return false;
      }
    }
    return true;
  }

  private initExpandedState(): void {
    const initialState: Record<string, boolean> = {};
    for (const group of this.groups()) {
      initialState[group.key] = group.isExpanded === undefined ? true : !!unwrapSignal(group.isExpanded);
    }
    this.expandedState.set(initialState);
  }

  public isExpanded(groupKey: string): boolean {
    return !!this.expandedState()[groupKey];
  }

  public toggleGroup(groupKey: string): void {
    this.expandedState.update(state => ({
      ...state,
      [groupKey]: !state[groupKey]
    }));
  }

  public unwrap(val: any): any {
    return unwrapSignal(val);
  }

  public getControl(key: string): import('@angular/forms').FormControl {
    return this.config().formGroup.get(key) as import('@angular/forms').FormControl;
  }

  public onSearch(): void {
    if (this.config().formGroup.valid) {
      const value = this.config().formGroup.value;
      this.search.emit(value);
      this.config().onSearch?.(value);
    }
  }

  public clearAll(): void {
    this.config().formGroup.reset();
  }

  public clearGroup(groupKey: string, event: Event): void {
    event.stopPropagation(); // Zapobiega zwijaniu akordeonu
    const group = this.groups().find(g => g.key === groupKey);
    if (group) {
      const patch: any = {};
      group.fields.forEach(f => {
        patch[f.key] = null;
      });
      this.config().formGroup.patchValue(patch);
    }
  }

  public confirmSave(): void {
    if (this.config().formGroup.valid && this.savePresetName.valid) {
      const val = this.config().formGroup.value;
      const name = this.savePresetName.value!;
      
      const existing = this.existingPresetNameWithSameFilters();
      if (existing && existing !== name) {
        this.deletePresetEvent.emit(existing);
      }
      
      this.savePresetEvent.emit({ name, value: val });
      this.savePresetName.reset('');
      this.saveDropdownOpen.set(false);
    }
  }

  public confirmLoad(presetName: string): void {
    this.loadPresetEvent.emit(presetName);
    this.loadDropdownOpen.set(false);
  }

  public deletePreset(presetName: string, event: Event): void {
    event.stopPropagation();
    this.deletePresetEvent.emit(presetName);
  }
}
