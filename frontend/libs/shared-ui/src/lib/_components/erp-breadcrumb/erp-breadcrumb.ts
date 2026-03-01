import { Component, OnInit } from '@angular/core';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'erp-breadcrumb',
  templateUrl: `./erp-breadcrumb.html`,
  styleUrls: ['./erp-breadcrumb.scss'],
  standalone: true,
  imports: [BreadcrumbModule],
})
export class ErpBreadcrumbComponent implements OnInit {
  public items: MenuItem[] | undefined;
  public home: MenuItem | undefined;

  public ngOnInit(): void {
    this.items = [
      { label: 'Electronics' },
      { label: 'Computer' },
      { label: 'Accessories' },
      { label: 'Keyboard' },
      { label: 'Wireless' },
    ];
    this.home = { icon: 'pi pi-home' };
  }
}
