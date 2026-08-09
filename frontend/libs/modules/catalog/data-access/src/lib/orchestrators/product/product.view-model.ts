import { ProductDto, ProductWarrantyDto } from '../../api-client';
import { CategoryVM } from '../category/category.view-model';
import { ModelVM } from '../model/model.view-model';
import { MultimediaVM } from '../multimedia/multimedia.view-model';
import { WarrantyVM } from '../warranty/warranty.view-model';

/**
 * Przypisanie produkt-gwarancja, wzbogacone o rozwiązaną gwarancję katalogową.
 * Rozszerza `ProductWarrantyDto` (kształt elementu `ProductDto.warranties[]`, czyli
 * kontrakt należący do Produktu, nie do Warranty), więc `warrantyUuid`/`durationMonths`
 * (okres przypisany do TEGO produktu) są dostępne od razu — `warranty` (dane katalogowe:
 * nazwa, standardowy okres, opis) jest `null`, dopóki nie zostanie doładowana.
 *
 * `productUuid` to celowy back-reference do produktu-właściciela — wypełniany podczas
 * mapowania w orkiestratorze. Pozwala konsumować pojedynczy element poza kontekstem
 * `ProductVM.warranties` (np. spłaszczone listy wielu produktów w tabelach) bez budowania
 * osobnych adapterów.
 */
export interface ProductWarrantyVM extends ProductWarrantyDto {
  readonly productUuid: string;
  readonly warranty: WarrantyVM | null;
}

export interface ProductVM extends ProductDto {
  /** Rozwiązane odniesienia do kategorii (z categoryUuids). */
  readonly categories: CategoryVM[];

  /** Rozwiązane odniesienie do modelu (z modelUuid) lub null. */
  readonly model: ModelVM | null;

  /** Rozwiązane multimedia powiązane z produktem. */
  readonly multimedia: MultimediaVM[];

  /**
   * Przypisania produkt-gwarancja, wzbogacone o rozwiązaną gwarancję katalogową.
   * Nadpisuje pole `warranties` z `ProductDto` podtypem (`ProductWarrantyVM extends
   * ProductWarrantyDto`) — więc `warrantyUuid`/`durationMonths` są dostępne od razu,
   * niezależnie od tego, czy katalogowe `WarrantyDto` zostały już doładowane.
   */
  readonly warranties: ProductWarrantyVM[];
}

export interface CatalogProductLoadOptions {
  readonly includeCategories?: boolean;
  readonly includeModel?: boolean;
  readonly includeMultimedia?: boolean;
  readonly includeWarranties?: boolean;
  [key: string]: boolean | undefined;
}
