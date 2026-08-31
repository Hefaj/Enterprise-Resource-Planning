import { WorkflowTransitionDto } from '../api-client';

/**
 * Kody pól z `WorkflowTransitionDto.requiredFields`, których nie da się wykonać PRZED
 * wysłaniem `IssueSetStateCommand` (WF-004).
 *
 * <p>Sprawdzenie jest wyłącznie frontowe i celowo powiela ten sam warunek, co backstop
 * w `Issue.SetState` — puste znaczy „brak klucza albo sam biały znak", dokładnie tak samo jak
 * agregat czyta `_customFields` po stronie serwera. Dwie kopie tej samej, jednolinijkowej
 * reguły są tańsze niż podróż do backendu tylko po to, żeby dowiedzieć się, że modal trzeba
 * było otworzyć.</p>
 *
 * <p>Używane zarówno z tablicy (`BoardStore.dropAsync`), jak i z karty zgłoszenia
 * (`IssueDetailComponent.applyTransitionAsync`) — stąd `data-access`, a nie kopia w każdym
 * z dwóch komponentów `feature`.</p>
 */
export function findMissingRequiredFieldCodes(
  transition: Pick<WorkflowTransitionDto, 'requiredFields'> | undefined,
  customFields: Record<string, string> | undefined,
): string[] {
  const required = transition?.requiredFields ?? [];

  if (required.length === 0) {
    return [];
  }

  return required.filter((code) => !(customFields?.[code] ?? '').trim());
}
