import { Injector } from '@angular/core';
import { ErpJobResultResolver } from '@erp/shared/data-access';

/**
 * Typy komend, których wyniki ten moduł potrafi zamienić na plik do pobrania.
 *
 * <b>Nazwa pochodzi wprost z backendu</b>
 * (`TaskManagement.Reports.Command.ReportRunCreateCommand`) i jest tym samym łańcuchem, który
 * ląduje w `job.command_type` — tak samo jak `ExportRunCreateCommand` w Catalogu
 * (`@erp/catalog/contract` `entry.job-results.ts`).
 */
export const remoteJobResultCommandTypes = ['ReportRunCreateCommand'] as const;

/**
 * Ładuje resolwer wyników zadań tego modułu.
 *
 * Leniwie, tak samo jak w Catalogu: sam kontrakt jedzie do hosta przy STARTUP (host potrzebuje
 * go do menu), ale `data-access` z wygenerowanym klientem HTTP dociąga się dopiero przy
 * pierwszym kliknięciu „Pobierz".
 */
export async function loadJobResultResolver(injector: Injector): Promise<ErpJobResultResolver> {
  const { createReportRunResultResolver } = await import('@erp/task-management/data-access');
  return createReportRunResultResolver(injector);
}
