import { ErpUserRef } from '@erp/shared/util';

import { IssueDto } from '../../api-client';
import { ProjectVM } from '../project/project.view-model';

/**
 * Zgłoszenie wzbogacone o projekt, do którego należy, i o ludzi, których wskazuje.
 *
 * Sam `IssueDto` niesie już `projectCode`, `stateCode` i `stateNameKey` — backend policzył je
 * w projekcji, żeby lista nie musiała doładowywać dwóch słowników na każdy wiersz. `project`
 * dochodzi dla karty zgłoszenia, gdzie widać pełną nazwę projektu i jego rodzaj
 * (`Delivery`/`Intake`), a nie sam prefiks klucza.
 *
 * <p><b>`assignee` i `reporter` rozwiązuje wspólny katalog użytkowników</b>
 * (`@erp/shared/data-access`), a nie backend Task Management: użytkownik jest bytem
 * ponadmodułowym i jego nazwa nie ma prawa być kopiowana do projekcji każdego modułu, który
 * na niego wskazuje. `undefined` znaczy „nazwisko jeszcze nie dojechało albo katalog tej osoby
 * nie zna" — widok pokazuje wtedy uuid, nie pustkę.</p>
 */
export interface IssueVM extends IssueDto {
  readonly project: ProjectVM | undefined;

  readonly assignee: ErpUserRef | undefined;

  readonly reporter: ErpUserRef | undefined;
}
