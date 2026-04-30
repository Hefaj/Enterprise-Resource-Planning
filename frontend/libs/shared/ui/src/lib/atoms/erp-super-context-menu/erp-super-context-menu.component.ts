import { Component, input, signal, computed, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PopoverModule } from 'primeng/popover';
import { ScrollerModule } from 'primeng/scroller';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';

export interface SuperMenuItem {
  id: string;
  label: string;
  icon?: string;
  isFavorite?: boolean;
  showSearch?: boolean; // Flaga konfigurująca wyszukiwarkę na danym poziomie
  action?: () => void;
  children?: SuperMenuItem[];
}

@Component({
  selector: 'erp-super-context-menu',
  standalone: true,
  imports: [CommonModule, FormsModule, PopoverModule, ScrollerModule, InputTextModule, ButtonModule],
  templateUrl: './erp-super-context-menu.component.html',
})
export class ErpSuperContextMenuComponent {
  @ViewChild('popover') public popover!: any;

  // Dane wejściowe
  public items = input.required<SuperMenuItem[]>();

  // Stan (Signals)
  public searchQuery = signal('');
  public navigationStack = signal<SuperMenuItem[]>([]); // Stos do nawigacji w głąb (Drill-down)

  // Obliczone menu dla aktualnego widoku (główne lub submenu)
  public currentItems = computed(() => {
    const stack = this.navigationStack();
    return stack.length === 0 ? this.items() : stack[stack.length - 1].children || [];
  });

  // Konfiguracja aktualnego poziomu (np. czy ma wyszukiwarkę)
  public currentLevelConfig = computed(() => {
    const stack = this.navigationStack();
    if (stack.length === 0) return { showSearch: true }; // Domyślnie główny poziom ma wyszukiwarkę
    return { showSearch: stack[stack.length - 1].showSearch ?? false };
  });

  // Ulubione wyciągane z głównego poziomu
  public favorites = computed(() => this.items().filter((i) => i.isFavorite));

  // Filtrowanie za pomocą wyszukiwarki
  public filteredItems = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const itemsToFilter = this.currentItems().filter((i) => !i.isFavorite); // Ukrywamy ulubione z głównej listy, bo są już na górze
    if (!query) return itemsToFilter;
    return itemsToFilter.filter((item) => item.label.toLowerCase().includes(query));
  });

  // API do wywoływania z zewnątrz (np. prawy klik z dyrektywy)
  public show(event: MouseEvent): void {
    this.navigationStack.set([]); // Reset na start
    this.searchQuery.set('');
    this.popover.toggle(event);
  }

  public handleItemClick(item: SuperMenuItem): void {
    if (item.children && item.children.length > 0) {
      this.searchQuery.set('');
      this.navigationStack.update((stack) => [...stack, item]);
    } else {
      this.executeAction(item);
    }
  }

  public goBack(): void {
    this.searchQuery.set('');
    this.navigationStack.update((stack) => stack.slice(0, -1));
  }

  public executeAction(item: SuperMenuItem): void {
    if (item.action) item.action();
    this.popover.hide();
  }

  public toggleFavorite(event: Event, item: SuperMenuItem): void {
    event.stopPropagation(); // Nie triggeruj wejścia w submenu/akcji
    item.isFavorite = !item.isFavorite;
    // W prawdziwej aplikacji tutaj wysłałbyś event do serwisu, aby zapisać stan w backendzie
  }
}
