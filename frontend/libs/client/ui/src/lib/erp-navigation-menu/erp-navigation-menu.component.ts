import { 
  Component, 
  input, 
  computed, 
  signal, 
  inject, 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TuiIcon, TuiExpand } from '@taiga-ui/core';
import { ErpNavigationMenuConfig, ErpNavigationItem } from './erp-navigation-menu.types';
import { unwrapSignal } from '@erp/shared/ui';

@Component({
  selector: 'erp-navigation-menu',
  standalone: true,
  imports: [CommonModule, TuiIcon, TuiExpand],
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .nav-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      position: relative;
      transition: opacity 0.2s;
    }

    .nav-container--loading {
      opacity: 0.75;
    }

    .nav-children {
      display: flex;
      flex-direction: column;
      width: 100%;
      position: relative;
    }

    .nav-btn {
      display: flex;
      align-items: center;
      width: 100%;
      text-align: left;
      min-height: 3rem;
      padding: 0 1rem;
      border: none;
      border-bottom: 1px solid var(--tui-border-normal);
      background: transparent;
      color: var(--tui-text-primary);
      font: var(--tui-font-text-m);
      font-weight: 500;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: background 0.15s ease;
    }

    .nav-btn:hover {
      background: var(--tui-background-neutral-1-hover);
    }

    .nav-btn--expanded {
      background: var(--tui-background-neutral-1);
    }

    .nav-btn--disabled {
      opacity: 0.5;
      pointer-events: none;
    }

    .nav-btn--child {
      font-size: 0.875rem;
    }

    .nav-level-indicator {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 0.375rem;
    }

    .nav-icon {
      margin-right: 0.75rem;
      flex-shrink: 0;
      color: var(--tui-text-secondary);
    }

    .nav-dot {
      margin-right: 0.75rem;
      width: 0.375rem;
      height: 0.375rem;
      border-radius: 50%;
      background: var(--tui-text-tertiary);
      flex-shrink: 0;
    }

    .nav-label {
        flex: 1;
        /* Nowe style dla max 2 linii */
        display: -webkit-box;
        -webkit-line-clamp: 2; /* Maksymalna liczba linii */
        -webkit-box-orient: vertical;
        overflow: hidden;
        word-break: break-word;
        line-height: 1.25;
        padding: 0.25rem 0; /* Delikatny odstęp pionowy dla długich nazw */
    }

    .nav-chevron {
      color: var(--tui-text-tertiary);
      flex-shrink: 0;
      margin-left: 0.5rem;
      transition: transform 0.2s ease;
    }
  `],
  template: `
    <ng-template #menuNode let-node="node" let-siblings="siblings" let-level="level">
      @let isNodeExpanded = isExpanded(node);
      @let hasChildren = !!node.children?.length;

      <button
        type="button"
        class="nav-btn"
        [class.nav-btn--expanded]="isNodeExpanded"
        [class.nav-btn--disabled]="node.disabled"
        [class.nav-btn--child]="level > 0"
        [disabled]="node.disabled || internalLoading()"
        (click)="handleNodeClick(node, siblings)"
      >
        @if (level > 0) {
          <div 
            class="nav-level-indicator" 
            [style.backgroundColor]="getLevelColor(level)"></div>
        }

        @if (node.iconId) {
          <tui-icon [icon]="node.iconId" class="nav-icon" />
        } @else if (level > 0) {
          <div class="nav-dot"></div>
        }

        <span class="nav-label">
          {{ node.label }}
        </span>

        @if (hasChildren) {
          <tui-icon
            [icon]="isNodeExpanded ? '@tui.chevron-up' : '@tui.chevron-down'"
            class="nav-chevron"
          />
        }
      </button>

      @if (hasChildren) {
        <tui-expand [expanded]="isNodeExpanded">
          <div class="nav-children">
            @for (child of node.children; track child.id || child.label) {
              <ng-container *ngTemplateOutlet="menuNode; context: { node: child, siblings: node.children, level: level + 1 }" />
            }
          </div>
        </tui-expand>
      }
    </ng-template>

    <div class="nav-container" [class.nav-container--loading]="internalLoading()">
      @for (item of items(); track item.id || item.label) {
        <ng-container *ngTemplateOutlet="menuNode; context: { node: item, siblings: items(), level: 0 }" />
      }
    </div>
  `
})
export class ErpNavigationMenuComponent {
  public config = input.required<ErpNavigationMenuConfig>();
  
  public items = computed(() => unwrapSignal(this.config().items) || []);
  public showSingle = computed(() => unwrapSignal(this.config().showSingle) ?? false);

  public internalLoading = signal(false);
  public expandedNodes = signal<Set<ErpNavigationItem>>(new Set());

  private router = inject(Router);

  public isExpanded(node: ErpNavigationItem): boolean {
    return this.expandedNodes().has(node);
  }

  public handleNodeClick(node: ErpNavigationItem, siblings: ErpNavigationItem[]): void {
    if (node.disabled) return;

    if (!node.children || node.children.length === 0) {
      if (node.route) {
        this.internalLoading.set(true);
        const routeArray = Array.isArray(node.route) ? node.route : [node.route];
        
        this.router.navigate(routeArray).finally(() => {
          this.internalLoading.set(false);
        });
      }
      return;
    }

    this.expandedNodes.update(currentSet => {
      const newSet = new Set(currentSet);
      const isCurrentlyExpanded = newSet.has(node);

      if (this.showSingle() && !isCurrentlyExpanded) {
        siblings.forEach(sibling => {
          if (sibling !== node) {
            this.deepRemove(newSet, sibling);
          }
        });
      }

      if (isCurrentlyExpanded) {
        this.deepRemove(newSet, node);
      } else {
        newSet.add(node);
      }

      return newSet;
    });
  }

  public getLevelColor(level: number): string {
    const palette = [
      'transparent',
      'var(--tui-status-info)',
      'var(--tui-status-positive)',
      'var(--tui-status-warning)',
      'var(--tui-chart-categorical-04)',
    ];
    return palette[level % palette.length] || 'var(--tui-text-tertiary)';
  }

  private deepRemove(set: Set<ErpNavigationItem>, node: ErpNavigationItem): void {
    set.delete(node);
    if (node.children) {
      node.children.forEach(child => this.deepRemove(set, child));
    }
  }
}