import { Injector } from '@angular/core';
import { ErpJobResultResolver } from '@erp/shared/data-access';

/**
 * Typy komend, których wyniki ten moduł potrafi zamienić na plik do pobrania.
 *
 * <b>Nazwy pochodzą wprost z backendu</b> (`Catalog.Application.ExportRuns.ExportRunCreateCommand`)
 * i są tym samym łańcuchem, który ląduje w `job.command_type`. Rozjazd nie wywali buildu po żadnej
 * stronie — po prostu przycisk „Pobierz" przestanie się pojawiać przy gotowych eksportach.
 */
export const remoteJobResultCommandTypes = ['ExportRunCreateCommand'] as const;

/**
 * Ładuje resolwer wyników zadań tego modułu.
 *
 * Leniwie, dokładnie tak jak `loadJobListComponent` w kontrakcie remota `notification`: sam
 * kontrakt jedzie do hosta przy STARTUP (host potrzebuje go do menu), ale `data-access`
 * z wygenerowanym klientem HTTP dociąga się dopiero przy pierwszym kliknięciu „Pobierz".
 */
export async function loadJobResultResolver(injector: Injector): Promise<ErpJobResultResolver> {
  const { createExportRunResultResolver } = await import('@erp/catalog/data-access');
  return createExportRunResultResolver(injector);
}
