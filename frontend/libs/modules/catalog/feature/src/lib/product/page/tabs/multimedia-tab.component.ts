import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpEmptyCardComponent, ErpEmptyCardBuilder } from '@erp/shared/ui';

@Component({
  selector: 'erp-multimedia-tab',
  standalone: true,
  imports: [CommonModule, ErpEmptyCardComponent],
  template: `
    <div class="tab-container">
      <div class="sections-grid">
        <div class="section-card">
          <erp-empty-card [config]="section1Config" />
        </div>
        <div class="section-card">
          <erp-empty-card [config]="section2Config" />
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
      .tab-container {
        padding: 1rem 0;
        height: 100%;
        box-sizing: border-box;
      }
      .sections-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 1.5rem;
        height: 100%;
      }
      @media (min-width: 1024px) {
        .sections-grid {
          grid-template-columns: 1fr 1fr;
        }
      }
      .section-card {
        height: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultimediaTabComponent {
  protected readonly section1Config = ErpEmptyCardBuilder.create((b) =>
    b
      .setIcon('pi pi-image')
      .setTitle('Galeria zdjęć')
      .setSubtitle('Zdjęcia produktu')
      .setDescription('Zarządzanie zdjęciami głównymi, wariantami oraz kolejnością wyświetlania w sklepie.')
      .setShowPulse(false)
  );

  protected readonly section2Config = ErpEmptyCardBuilder.create((b) =>
    b
      .setIcon('pi pi-video')
      .setTitle('Materiały wideo i 3D')
      .setSubtitle('Wideo oraz modele')
      .setDescription('Dodawanie filmów promocyjnych, instruktażowych oraz wizualizacji 3D i AR.')
      .setShowPulse(false)
  );
}
