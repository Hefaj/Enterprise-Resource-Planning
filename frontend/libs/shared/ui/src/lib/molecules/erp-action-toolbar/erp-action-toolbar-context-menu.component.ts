import { ChangeDetectionStrategy, Component, input, output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpActionToolbarMegaMenuComponent } from './erp-action-toolbar-mega-menu.component';
import { ErpActionGroup, ErpDynamicActionProvider } from './erp-action-toolbar.types';

@Component({
  selector: 'erp-action-toolbar-context-menu',
  standalone: true,
  imports: [CommonModule, ErpActionToolbarMegaMenuComponent],
  template: `
    <div class="erp-ctx-mega-menu">
      <erp-action-toolbar-mega-menu
        [groups]="groups()"
        [dynamicProviders]="dynamicProviders()"
        [customShortcuts]="customShortcuts()"
        (actionClick)="closed.emit()"
        (dynamicActionClick)="closed.emit()"
      />
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: scale(0.95) translateY(-4px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    .erp-ctx-mega-menu {
      border-radius: 0.75rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      max-height: 70vh;
      max-width: 85vw;
      background: var(--tui-background-base);
      overflow: hidden;
      animation: fadeIn 150ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpActionToolbarContextMenuComponent {
  readonly groups = input.required<ErpActionGroup[]>();
  readonly dynamicProviders = input<ErpDynamicActionProvider[]>([]);
  readonly customShortcuts = input<Record<string, string>>({});
  
  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closed.emit();
  }

  @HostListener('contextmenu', ['$event'])
  protected onContextMenu(event: MouseEvent): void {
    if (!event.shiftKey) {
      event.preventDefault();
    }
  }
}
