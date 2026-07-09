import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpMenuBarComponent, ErpMenuBarBuilder } from '@erp/shared/ui';

@Component({
  selector: 'erp-product-tab',
  standalone: true,
  imports: [CommonModule, ErpMenuBarComponent],
  template: `
    <div style="padding: 1rem; display: flex; flex-direction: column; gap: 1.5rem;">
      <h3>Test komponentu ErpMenuBar (Poziomy)</h3>
      <erp-menu-bar [config]="horizontalMenu" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductTabComponent {
  protected readonly horizontalMenu = ErpMenuBarBuilder.create((b) =>
    b
      .addItem((i) =>
        i
          .setLabel('Akcje podstawowe')
          .setIconStart('@tui.play')
          .addChild((c) =>
            c
              .setLabel('Uruchom test')
              .setIconStart('@tui.circle')
              .setAppearance('info')
              .setFn(() => console.log('Run test'))
          )
          .addChild((c) =>
            c
              .setLabel('Opcje zaawansowane')
              .setIconStart('@tui.sliders-horizontal')
              .addChild((cc) =>
                cc
                  .setLabel('Eksport danych')
                  .setIconStart('@tui.download')
                  .addChild((ccc) =>
                    ccc
                      .setLabel('Eksport do PDF')
                      .setIconStart('@tui.file')
                      .setFn(async () => {
                        console.log('PDF export started...');
                        await new Promise((resolve) => setTimeout(resolve, 2000));
                        console.log('PDF export completed!');
                      })
                  )
                  .addChild((ccc) =>
                    ccc
                      .setLabel('Eksport do Excel')
                      .setIconStart('@tui.file-text')
                      .setAppearance('info')
                      .setHint('Wygeneruj arkusz kalkulacyjny XLSX')
                  )
              )
              .addChild((cc) =>
                cc
                  .setLabel('Usuń produkt')
                  .setIconStart('@tui.trash-2')
                  .setAppearance('warning')
                  .setFn(() => console.log('Delete product'))
              )
          )
      )
      .addItem((i) =>
        i
          .setLabel('Asynchroniczne ładowanie')
          .setIconStart('@tui.refresh-cw')
          .setFn(async () => {
            console.log('Async operation started...');
            await new Promise((resolve) => setTimeout(resolve, 3000));
            console.log('Async operation completed!');
          })
      )
      .addSeparator()
      .addItem((i) =>
        i
          .setLabel('Pomoc i informacje')
          .setIconStart('@tui.info')
          .addChild((c) =>
            c
              .setLabel('Dokumentacja')
              .setDisabled(true)
              .setIconStart('@tui.file-text')
              .setHint('Otwórz podręcznik użytkownika')
          )
          .addChild((c) =>
            c
              .setLabel('Status systemu')
              .setIconStart('@tui.activity')
              .setAppearance('info')
              .addChild((cc) =>
                cc
                  .setLabel('Submenu 1')
                  .setFn(() => console.log('Submenu 1 clicked'))
                  .addChild((ccc) => ccc.setLabel('Submenu 1.1').setFn(() => console.log('Submenu 1.1 clicked')))
              )
              .addChild((cc) =>
                cc
                  .setLabel('Submenu 2')
                  .setFn(() => console.log('Submenu 2 clicked'))
                  .addChild((ccc) =>
                    ccc.setLabel('Submenu 2.1').setFn(() => console.log('Submenu 2.1 clicked')).addChild((cccc) => cccc.setLabel('Submenu 2.1.1').setFn(() => console.log('Submenu 2.1.1 clicked')))
                  )
              )
          )
      )
  );
}

