import { ISSUE_LINK_TYPE, WORKFLOW_STATE_CATEGORY } from '@erp/task-management/util';

import { IssueChildDto, IssueGraphDto, IssueLinkDto } from '../api-client';

/**
 * Odczyty grafu zgłoszenia dla dwóch ostrzeżeń walidacyjnych (`LNK-004`, `LNK-005`).
 *
 * <p><b>To są ostrzeżenia, nie reguły domenowe.</b> Backend świadomie ich nie egzekwuje
 * (`docs/modules/task-management/requirements.md` LNK-004 AC1, LNK-005 AC1) — trzeba je
 * sprawdzić przed wysłaniem komendy, a nie interpretować odpowiedź backendu. Wywołujący
 * decyduje: brak wyniku znaczy „nic do ostrzeżenia", niepusta lista — pokaż potwierdzenie
 * i wykonaj zmianę mimo to, jeśli użytkownik potwierdzi.</p>
 */

/** Otwarte (kategoria stanu ≠ `Done`) dzieci zgłoszenia — `LNK-004`. */
export function openChildrenOf(graph: IssueGraphDto | undefined): IssueChildDto[] {
  return (graph?.children ?? []).filter((child) => child.stateCategory !== WORKFLOW_STATE_CATEGORY.Done);
}

/**
 * Zgłoszenia, które BLOKUJĄ to zgłoszenie i same nie są zamknięte — `LNK-005`.
 *
 * <p>Krawędź `Blocks` przychodząca (`isOutgoing === false`) znaczy „inne zgłoszenie blokuje
 * to" — strona odwrotna tej samej krawędzi u źródła czyta się jako „to blokuje inne"
 * (`IssueLinkDto.isOutgoing`, `docs/modules/task-management/domain.md` §8.1).</p>
 */
export function openBlockersOf(graph: IssueGraphDto | undefined): IssueLinkDto[] {
  return (graph?.links ?? []).filter(
    (link) =>
      link.type === ISSUE_LINK_TYPE.Blocks &&
      !link.isOutgoing &&
      link.otherStateCategory !== WORKFLOW_STATE_CATEGORY.Done,
  );
}
