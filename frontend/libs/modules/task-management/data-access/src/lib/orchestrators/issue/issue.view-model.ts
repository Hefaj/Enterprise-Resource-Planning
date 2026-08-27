import { IssueDto } from '../../api-client';
import { ProjectVM } from '../project/project.view-model';

/**
 * Zgłoszenie wzbogacone o projekt, do którego należy.
 *
 * Sam `IssueDto` niesie już `projectCode`, `stateCode` i `stateNameKey` — backend policzył je
 * w projekcji, żeby lista nie musiała doładowywać dwóch słowników na każdy wiersz. `project`
 * dochodzi dla karty zgłoszenia, gdzie widać pełną nazwę projektu i jego rodzaj
 * (`Delivery`/`Intake`), a nie sam prefiks klucza.
 */
export interface IssueVM extends IssueDto {
  readonly project: ProjectVM | undefined;
}
