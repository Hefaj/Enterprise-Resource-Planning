import { ChangeDetectionStrategy, Component, computed, forwardRef, input, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PopoverModule } from 'primeng/popover';
import { TreeModule } from 'primeng/tree';
import { CheckboxModule } from 'primeng/checkbox';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TreeNode } from 'primeng/api';
import { ErpTreeSelection, ErpTreeSelectConfig } from './erp-tree-select.types';
import { noop } from 'rxjs';
import { ErpTreeSelectBuilder } from './erp-tree-select.builder';
import { Directive, ElementRef, EventEmitter, OnDestroy, OnInit, Output, NgZone } from '@angular/core';

@Directive({
  selector: '[erpIntersect]',
  standalone: true
})
export class ErpIntersectDirective implements OnInit, OnDestroy {
  @Output() erpIntersect = new EventEmitter<void>();
  private observer: IntersectionObserver | null = null;

  constructor(private el: ElementRef, private zone: NgZone) {}

  ngOnInit() {
    this.observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        this.zone.run(() => {
          this.erpIntersect.emit();
        });
      }
    });
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}

export { ErpTreeSelectBuilder };

@Component({
  selector: 'erp-tree-select',
  standalone: true,
  imports: [CommonModule, PopoverModule, TreeModule, CheckboxModule, FormsModule, ErpIntersectDirective],
  template: `
    <div 
      class="border border-slate-300 rounded-md px-3 py-2 cursor-pointer flex justify-between items-center bg-white hover:border-slate-400"
      (click)="!disabled && op.toggle($event)"
      [class.opacity-50]="disabled"
      [class.cursor-not-allowed]="disabled"
    >
      <span class="text-slate-700 truncate">
        {{ displayText() }}
      </span>
      <i class="pi pi-chevron-down text-slate-500 text-sm"></i>
    </div>

    <p-popover #op [style]="{'min-width': '350px', 'max-width': '600px'}">
      <div class="max-h-[500px] overflow-auto">
        <p-tree 
          [value]="optionsWithParents()" 
          class="w-full border-none p-0 erp-tree-hide-toggler"
          (onNodeExpand)="handleNodeExpand($event)"
          (onNodeCollapse)="realignPopover()"
        >
          <ng-template let-node pTemplate="default">
            @if (node.data?.isLoadMore) {
              <div class="flex items-center justify-center w-full py-2 text-slate-500 gap-2 select-none cursor-pointer" (erpIntersect)="triggerLoadMore(node)" (click)="triggerLoadMore(node)">
                <i class="pi pi-spinner pi-spin"></i>
                <span class="text-sm">Doczytywanie...</span>
              </div>
            } @else {
              <div class="flex flex-col w-full">
              <!-- GŁÓWNY WIERSZ RODZICA -->
              <div class="flex items-center justify-between flex-1 pr-2 gap-4 cursor-pointer select-none" (click)="toggleExpand(node, $event)">
                <div class="flex items-center gap-2 flex-1" (click)="$event.stopPropagation()">
                  
                  @if (node.children?.length || node.leaf === false) {
                    <div class="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors cursor-pointer" (click)="toggleExpand(node, $event)">
                      @if (isLoading(node)) {
                        <i class="pi pi-spinner pi-spin text-slate-400 text-sm"></i>
                      } @else {
                        <i class="pi text-slate-500 text-sm" [ngClass]="node.expanded ? 'pi-chevron-down' : 'pi-chevron-right'"></i>
                      }
                    </div>
                  } @else {
                    <div class="w-6 h-6"></div>
                  }

                  <p-checkbox 
                    [binary]="true" 
                    [ngModel]="isNodeChecked(node)" 
                    [disabled]="isNodeDisabled(node)"
                    (ngModelChange)="toggleNode(node, $event)" 
                  />
                  <!-- Klikalny obszar tekstu -->
                  <div class="flex-1 py-1" (click)="toggleNode(node, !isNodeChecked(node))">
                    <span [class.text-slate-400]="isNodeDisabled(node)">{{ node.label }}</span>
                  </div>
                </div>
              </div>
              
              <!-- "WSZYSTKIE DZIECI" SYMULUJĄCE PIERWSZE DZIECKO -->
              @if (node.children?.length || node.leaf === false) {
                <div class="pl-6 mt-2 mb-1">
                  <div class="flex items-center gap-2 w-full select-none" (click)="$event.stopPropagation()">
                    <div class="w-6 h-6"></div> <!-- Pusty spacer (jak u liścia) żeby zrównać checkboxy w linii -->
                    <p-checkbox 
                      [binary]="true" 
                      [ngModel]="isAllChildrenChecked(node)" 
                      (ngModelChange)="toggleAllChildren(node, $event)" 
                    />
                    <div class="flex-1 py-1 cursor-pointer" (click)="toggleAllChildren(node, !isAllChildrenChecked(node))">
                      <span class="text-sm text-slate-600 hover:underline whitespace-nowrap">
                        Wszystkie dzieci
                      </span>
                    </div>
                  </div>
                </div>
              }
              </div>
            }
          </ng-template>
        </p-tree>
      </div>
    </p-popover>
  `,
  styles: [`
    ::ng-deep .erp-tree-hide-toggler .p-tree-toggler,
    ::ng-deep .erp-tree-hide-toggler .p-tree-node-toggle-button {
      display: none !important;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ErpTreeSelectComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpTreeSelectComponent implements ControlValueAccessor {
  @ViewChild('op') op!: any;
  
  public config = input.required<ErpTreeSelectConfig>();
  
  public disabled = false;
  private _selection = signal<ErpTreeSelection>({ selectedItems: [], selectedChildrenOf: [] });
  private _loadingNodes = signal<Set<string>>(new Set());
  public isLoadingMore = signal(false);
  
  private _refreshTrigger = signal(0);
  
  private onTouched: () => void = noop;
  private onChange: (value: ErpTreeSelection) => void = noop;

  public optionsWithParents = computed(() => {
    this._refreshTrigger(); // Wymusza przeliczenie przy każdej zmianie
    const opts = this.config().options || [];
    const attach = (nodes: TreeNode[], parent?: TreeNode) => {
      nodes.forEach(n => {
        n.parent = parent;
        if (n.children) attach(n.children, n);
      });
    };
    const clonedOpts = [...opts];
    attach(clonedOpts);
    return clonedOpts;
  });

  public displayText = computed(() => {
    const sel = this._selection();
    const countItems = new Set([...sel.selectedItems, ...sel.selectedChildrenOf]).size;
    return countItems > 0 ? `Wybrano: ${countItems}` : (this.config().placeholder || 'Wybierz...');
  });

  public writeValue(val: any): void {
    if (val) {
      this._selection.set({
        selectedItems: val.selectedItems || [],
        selectedChildrenOf: val.selectedChildrenOf || []
      });
    } else {
      this._selection.set({ selectedItems: [], selectedChildrenOf: [] });
    }
  }

  public registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  public isNodeDisabled(node: TreeNode): boolean {
    if (!node.key) return false;
    let current = node.parent;
    const selectedChildrenOf = this._selection().selectedChildrenOf;
    while (current) {
      if (current.key && selectedChildrenOf.includes(current.key)) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  public isNodeChecked(node: TreeNode): boolean {
    if (!node.key) return false;
    if (this.isNodeDisabled(node)) return true;
    return this._selection().selectedItems.includes(node.key);
  }

  public isAllChildrenChecked(node: TreeNode): boolean {
    if (!node.key) return false;
    return this._selection().selectedChildrenOf.includes(node.key);
  }

  public isLoading(node?: TreeNode): boolean {
    if (!node || !node.key) return false;
    return this._loadingNodes().has(node.key);
  }

  public realignPopover(): void {
    setTimeout(() => {
      if (this.op && typeof this.op.align === 'function') {
        this.op.align();
      }
    }, 50);
  }

  public triggerLoadMore(loadMoreNode: TreeNode): void {
    if (this.isLoadingMore() || !this.config().onLoadMore) return;
    
    this.isLoadingMore.set(true);
    // Przekazujemy węzeł nadrzędny, aby komponent-rodzic wiedział dla jakiej gałęzi dograć elementy.
    // Jeżeli data.parentNode to null, doczytujemy poziom Root.
    const parentNode = loadMoreNode.data?.parentNode || null;
    
    const res = this.config().onLoadMore!(parentNode);
    if (res && typeof res.then === 'function') {
      res.then(() => {
        this.isLoadingMore.set(false);
        this._refreshTrigger.update(v => v + 1);
        this.realignPopover();
      }).catch(() => {
        this.isLoadingMore.set(false);
      });
    } else {
      this.isLoadingMore.set(false);
      this._refreshTrigger.update(v => v + 1);
      this.realignPopover();
    }
  }

  public handleNodeExpand(event: any): void {
    this.triggerNodeExpand(event.node);
  }

  public toggleExpand(node: TreeNode, event: Event): void {
    node.expanded = !node.expanded;
    if (node.expanded) {
      this.triggerNodeExpand(node);
    }
    this.realignPopover();
  }

  private triggerNodeExpand(node: TreeNode): void {
    if (this.config().onNodeExpand && node.leaf === false && (!node.children || node.children.length === 0)) {
      this._loadingNodes.update(set => {
        const newSet = new Set(set);
        newSet.add(node.key!);
        return newSet;
      });
      
      const res = this.config().onNodeExpand!(node);
      if (res && typeof res.then === 'function') {
        res.then(() => {
          this._loadingNodes.update(set => {
            const newSet = new Set(set);
            newSet.delete(node.key!);
            return newSet;
          });
          this._refreshTrigger.update(v => v + 1);
          this.realignPopover();
        });
      } else {
        this._loadingNodes.update(set => {
          const newSet = new Set(set);
          newSet.delete(node.key!);
          return newSet;
        });
        this._refreshTrigger.update(v => v + 1);
      }
    } else {
      this.realignPopover();
    }
  }

  private updateSelection(newSelection: ErpTreeSelection): void {
    this._selection.set(newSelection);
    this.onChange(newSelection);
    this.onTouched();
  }

  public toggleNode(node: TreeNode, checked: boolean): void {
    if (!node.key || this.isNodeDisabled(node)) return;

    const currentSel = this._selection();
    const items = new Set(currentSel.selectedItems);
    const childrenOf = new Set(currentSel.selectedChildrenOf);
    
    if (checked) {
      items.add(node.key);
      childrenOf.add(node.key);
    } else {
      items.delete(node.key);
      childrenOf.delete(node.key);
    }
    
    this.updateSelection({
      selectedItems: Array.from(items),
      selectedChildrenOf: Array.from(childrenOf)
    });
  }

  public toggleAllChildren(node: TreeNode, checked: boolean): void {
    if (!node.key) return;

    const currentSel = this._selection();
    const childrenOf = new Set(currentSel.selectedChildrenOf);
    if (checked) {
      childrenOf.add(node.key);
    } else {
      childrenOf.delete(node.key);
    }
    
    this.updateSelection({
      ...currentSel,
      selectedChildrenOf: Array.from(childrenOf)
    });
  }
}
