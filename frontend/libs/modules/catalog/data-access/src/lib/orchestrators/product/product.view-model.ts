import {
  AttributeOptionDto,
  ProductAttributeValueDto,
  ProductCodeDto,
  ProductDto,
  ProductWarrantyDto,
} from '../../api-client';
import { AttributeVM } from '../attribute/attribute.view-model';
import { CategoryVM } from '../category/category.view-model';
import { CodeTypeVM } from '../code-type/code-type.view-model';
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

/**
 * Kod produktu wzbogacony o rozwiązany typ ze słownika. Ta sama konstrukcja co przy
 * `ProductWarrantyVM`: `value` jest dostępne od razu, `codeType` (symbol, nazwa, maska)
 * jest `null`, dopóki słownik nie zostanie doładowany.
 */
export interface ProductCodeVM extends ProductCodeDto {
  readonly productUuid: string;
  readonly codeType: CodeTypeVM | null;
}

/**
 * Wartość atrybutu wzbogacona o rozwiązaną definicję i — dla atrybutów słownikowych —
 * o wybraną pozycję. Bez nich `attributes[]` niesie same identyfikatory: wiadomo, że coś
 * jest wybrane, ale nie wiadomo co ani jak się nazywa.
 */
export interface ProductAttributeVM extends ProductAttributeValueDto {
  readonly productUuid: string;
  readonly attribute: AttributeVM | null;
  readonly option: AttributeOptionDto | null;
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

  /** Kody produktu z rozwiązanym typem — nadpisuje `codes` z `ProductDto` podtypem. */
  readonly codes: ProductCodeVM[];

  /** Wartości atrybutów z rozwiązaną definicją — nadpisuje `attributes` z `ProductDto`. */
  readonly attributes: ProductAttributeVM[];

  /**
   * Wartość kodu wskazanego typu, po symbolu ze słownika (`SKU`, `EAN`…);
   * `null`, gdy produkt takiego kodu nie ma albo słownik nie jest jeszcze doładowany.
   *
   * Metoda, a nie pole `sku`: zbiór typów kodów jest danymi, a nie schematem, więc
   * dopisanie ich na sztywno do ViewModelu odtworzyłoby dokładnie ten problem, który
   * przebudowa usunęła po stronie bazy.
   */
  readonly codeValue: (symbol: string) => string | null;
}

export interface CatalogProductLoadOptions {
  readonly includeCategories?: boolean;
  readonly includeModel?: boolean;
  readonly includeMultimedia?: boolean;
  readonly includeWarranties?: boolean;

  /** Doładuj słownik typów kodów — bez niego `codeValue()` zawsze zwraca `null`. */
  readonly includeCodeTypes?: boolean;

  /** Doładuj definicje atrybutów wraz z ich pozycjami słownikowymi. */
  readonly includeAttributes?: boolean;
  [key: string]: boolean | undefined;
}
