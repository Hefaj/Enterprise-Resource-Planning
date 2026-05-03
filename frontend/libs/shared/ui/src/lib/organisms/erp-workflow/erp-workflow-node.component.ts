import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, output, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkflowNode, WorkflowNodeAction } from './erp-workflow.types';
import { MenuModule } from 'primeng/menu';
import { ButtonModule } from 'primeng/button';
import { MenuItem } from 'primeng/api';
import { TemplateRef } from '@angular/core';

@Component({
  selector: 'erp-workflow-node',
  standalone: true,
  imports: [CommonModule, MenuModule, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isGateway()) {
      <div 
        class="absolute flex items-center justify-center cursor-pointer overflow-visible group"
        [style.left.px]="node().position.x"
        [style.top.px]="node().position.y"
        [style.width.px]="60"
        [style.height.px]="60"
        (mousedown)="onMouseDown($event)"
      >
        <!-- Diamond Shape -->
        <div class="absolute inset-0 border-2 rounded shadow-sm rotate-45 transition-all"
             [ngClass]="gatewayStatusClass()"></div>
             
        <!-- Icon -->
        <span class="relative z-10 font-bold text-sm text-surface-700 dark:text-surface-200 pointer-events-none" style="transform: rotate(-45deg)">
          @if (node().type === 'and') {
            AND
          } @else {
            OR
          }
        </span>
        
        <!-- Actions Menu -->
        @if (!readonlyMode() && menuItems().length > 0) {
          <div class="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-30">
            <p-button icon="pi pi-ellipsis-v" [text]="true" [rounded]="true" severity="secondary" size="small" (onClick)="menuGateway.toggle($event); $event.stopPropagation()" />
            <p-menu #menuGateway [model]="menuItems()" [popup]="true" appendTo="body" />
          </div>
        }

        <!-- Output Handle -->
        <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-primary-500 rounded-full border-2 border-white cursor-pointer hover:scale-125 transition-transform shadow-sm z-20"
             (mousedown)="onHandleMouseDown($event, 'default')"></div>
             
        <!-- Input Handle -->
        <div class="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-surface-400 rounded-full border-2 border-white z-20"></div>
      </div>
    } @else {
      <div 
        class="absolute rounded-xl border bg-surface-0 dark:bg-surface-900 overflow-visible transition-shadow transition-colors flex flex-col"
        [ngClass]="statusBorderClass()"
        [style.left.px]="node().position.x"
        [style.top.px]="node().position.y"
        [style.width.px]="node().width || 200"
        [style.cursor]="readonlyMode() ? 'default' : 'grab'"
        (mousedown)="onMouseDown($event)"
      >
        <!-- Header -->
        <div class="px-4 py-2 flex justify-between items-center rounded-t-xl"
             [ngClass]="headerBgClass()">
          <div class="flex items-center gap-2 flex-1 overflow-hidden">
            @if (node().status === 'completed') {
              <i class="pi pi-check-circle text-green-600 dark:text-green-400"></i>
            } @else if (node().status === 'in-progress') {
              <i class="pi pi-spin pi-spinner text-primary-600 dark:text-primary-400"></i>
            } @else if (node().status === 'error') {
              <i class="pi pi-exclamation-circle text-red-600 dark:text-red-400"></i>
            }
            <span class="font-semibold text-sm truncate text-surface-900 dark:text-surface-0">
              {{ node().label }}
            </span>
          </div>
          
          <!-- Actions Menu -->
          @if (!readonlyMode() && menuItems().length > 0) {
            <div class="ml-2">
              <p-button 
                icon="pi pi-ellipsis-v" 
                [text]="true" 
                [rounded]="true" 
                severity="secondary" 
                size="small"
                (onClick)="menu.toggle($event); $event.stopPropagation()"
              />
              <p-menu #menu [model]="menuItems()" [popup]="true" appendTo="body" />
            </div>
          }
        </div>

        <!-- Content -->
        <div class="flex-1 flex flex-col">
          @if (customTemplate()) {
            <ng-container *ngTemplateOutlet="customTemplate()!; context: { $implicit: node() }"></ng-container>
          } @else if (!hasContent()) {
            <div class="p-4 text-xs text-surface-500">
              Type: {{ node().type }}
            </div>
          }
          <ng-content></ng-content>
        </div>

        <!-- Output Handles (Dots) -->
        @if (node().type === 'condition') {
          <div class="absolute -bottom-2 left-1/4 w-4 h-4 bg-red-500 rounded-full border-2 border-white cursor-pointer hover:scale-125 transition-transform shadow-sm"
               title="False"
               (mousedown)="onHandleMouseDown($event, 'false')"></div>
          <div class="absolute -bottom-2 right-1/4 w-4 h-4 bg-green-500 rounded-full border-2 border-white cursor-pointer hover:scale-125 transition-transform shadow-sm"
               title="True"
               (mousedown)="onHandleMouseDown($event, 'true')"></div>
        } @else if (node().type !== 'end') {
          <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-primary-500 rounded-full border-2 border-white cursor-pointer hover:scale-125 transition-transform shadow-sm"
               (mousedown)="onHandleMouseDown($event, 'default')"></div>
        }
        
        <!-- Input Handle (Dot) -->
        @if (node().type !== 'start') {
          <div class="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-surface-400 rounded-full border-2 border-white"></div>
        }
      </div>
    }
  `
})
export class ErpWorkflowNodeComponent implements AfterViewInit, OnDestroy {
  node = input.required<WorkflowNode>();
  readonlyMode = input<boolean>(false);
  actions = input<WorkflowNodeAction[]>([]);
  customTemplate = input<TemplateRef<any> | undefined>();
  
  dragStart = output<MouseEvent>();
  connectionStart = output<{ event: MouseEvent, sourceHandle: string }>();
  deleteRequest = output<string>();
  heightChange = output<{ id: string, height: number }>();

  el = inject(ElementRef);
  private resizeObserver: ResizeObserver | null = null;

  ngAfterViewInit() {
    this.resizeObserver = new ResizeObserver(entries => {
      requestAnimationFrame(() => {
        for (let entry of entries) {
          const height = (entry.target as HTMLElement).offsetHeight;
          if (this.node().height !== height) {
            this.heightChange.emit({ id: this.node().id, height });
          }
        }
      });
    });
    
    const wrapper = this.el.nativeElement.firstElementChild;
    if (wrapper) {
      this.resizeObserver.observe(wrapper);
    }
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
  }

  hasContent(): boolean {
    return this.el.nativeElement.querySelector('ng-content')?.childNodes.length > 0;
  }

  isGateway(): boolean {
    return this.node().type === 'and' || this.node().type === 'or';
  }

  statusBorderClass = computed(() => {
    switch (this.node().status) {
      case 'completed': return 'border-green-500 ring-2 ring-green-500/50 shadow-lg';
      case 'in-progress': return 'border-primary-500 ring-2 ring-primary-500/50 shadow-lg';
      case 'error': return 'border-red-500 ring-2 ring-red-500/50 shadow-lg';
      default: return 'border-surface-200 dark:border-surface-700 shadow-md hover:shadow-lg';
    }
  });

  gatewayStatusClass = computed(() => {
    const base = this.node().type === 'and' 
      ? 'bg-blue-50 dark:bg-blue-900/20 ' 
      : 'bg-orange-50 dark:bg-orange-900/20 ';
      
    switch (this.node().status) {
      case 'completed': return base + 'border-green-500 ring-2 ring-green-500/50 shadow-lg';
      case 'in-progress': return base + 'border-primary-500 ring-2 ring-primary-500/50 shadow-lg';
      case 'error': return base + 'border-red-500 ring-2 ring-red-500/50 shadow-lg';
      default: return base + (this.node().type === 'and' ? 'border-blue-400 dark:border-blue-600 shadow-sm hover:shadow-md' : 'border-orange-400 dark:border-orange-600 shadow-sm hover:shadow-md');
    }
  });

  menuItems = computed<MenuItem[]>(() => {
    // 1. Global actions
    const items: MenuItem[] = this.actions().map(action => ({
      label: action.label,
      icon: action.icon,
      command: (e: any) => action.command({ originalEvent: e.originalEvent, node: this.node() })
    }));

    // 2. Node-specific actions
    const nodeActions = this.node().actions || [];
    nodeActions.forEach(action => {
      items.push({
        label: action.label,
        icon: action.icon,
        command: (e: any) => action.command({ originalEvent: e.originalEvent, node: this.node() })
      });
    });

    // 3. Delete action
    if (!this.readonlyMode()) {
      if (items.length > 0) {
        items.push({ separator: true });
      }
      items.push({
        label: 'Usuń Węzeł',
        icon: 'pi pi-trash',
        command: () => this.deleteRequest.emit(this.node().id)
      });
    }

    return items;
  });

  headerBgClass = computed(() => {
    const type = this.node().type;
    switch(type) {
      case 'start': return 'bg-green-100 dark:bg-green-900/30';
      case 'end': return 'bg-red-100 dark:bg-red-900/30';
      case 'condition': return 'bg-yellow-100 dark:bg-yellow-900/30';
      case 'loop': return 'bg-purple-100 dark:bg-purple-900/30';
      case 'action': return 'bg-blue-100 dark:bg-blue-900/30';
      default: return 'bg-surface-100 dark:bg-surface-800';
    }
  });

  onMouseDown(event: MouseEvent): void {
    if (this.readonlyMode()) return;
    event.stopPropagation();
    this.dragStart.emit(event);
  }

  onHandleMouseDown(event: MouseEvent, handle: string): void {
    if (this.readonlyMode()) return;
    event.stopPropagation();
    this.connectionStart.emit({ event, sourceHandle: handle });
  }

  onDeleteClick(event: MouseEvent): void {
    event.stopPropagation();
    this.deleteRequest.emit(this.node().id);
  }
}
