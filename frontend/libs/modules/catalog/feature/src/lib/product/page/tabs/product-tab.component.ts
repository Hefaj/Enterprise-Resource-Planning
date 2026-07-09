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

      <h3>Test komponentu ErpMenuBar (Pionowy)</h3>
      <div style="width: 250px;">
        <erp-menu-bar [config]="verticalMenu" />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductTabComponent {
  protected readonly horizontalMenu = ErpMenuBarBuilder.create((b) =>
    b
      .setDirection('horizontal')
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
          )
      )
  );

  protected readonly verticalMenu = ErpMenuBarBuilder.create((b) =>
    b
      .setDirection('vertical')
      .addItem((i) =>
        i.setLabel('Profil').setIconStart('@tui.user').setFn(() => console.log('Profil clicked'))
      )
      .addItem((i) =>
        i
          .setLabel('Ustawienia')
          .setIconStart('@tui.settings')
          .addChild((c) =>
            c
              .setLabel('Konto')
              .setSubLabel('Zarządzanie hasłem i e-mailem')
              .setCloseOnClick(false)
              .setFn(async () => {
                console.log('Async operation started...');
                await new Promise((resolve) => setTimeout(resolve, 3000));
                console.log('Async operation completed!');
              })
          )
          .addSeparator()
          .addChild((c) =>
            c.setLabel('Powiadomienia')
          )
      )
      .addSeparator()
      .addItem((i) =>
        i
          .setLabel('Wyloguj')
          .setIconStart('@tui.log-out')
          .setAppearance('warning')
          .setFn(() => console.log('Logout clicked'))
      )
  );
}

