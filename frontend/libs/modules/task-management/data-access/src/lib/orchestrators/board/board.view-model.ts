import { ErpUserRef } from '@erp/shared/util';

import { BoardCardDto } from '../../api-client';

/**
 * Karta na tablicy wzbogacona o osobę przypisaną.
 *
 * Nagłówek zgłoszenia (klucz, tytuł, stan, priorytet) przychodzi razem z kartą jednym
 * zapytaniem — tablica rysuje kilkaset kart naraz i druga podróż po dane, które i tak trzeba
 * pokazać od razu, byłaby czystym kosztem.
 *
 * <p><b>`rank` bywa pusty</b> i to nie jest błąd: zgłoszenie, którego nikt jeszcze nie
 * przestawiał, nie ma wiersza w `board_card` i ląduje na końcu swojej kolumny. Wiersz powstaje
 * przy pierwszym przeciągnięciu (`docs/modules/task-management/domain.md` §7.1).</p>
 */
export interface BoardCardVM extends BoardCardDto {
  readonly assignee: ErpUserRef | undefined;
}
