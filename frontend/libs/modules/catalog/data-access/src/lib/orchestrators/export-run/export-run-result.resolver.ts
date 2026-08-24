import { Injector, runInInjectionContext, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ErpJobResultLink, ErpJobResultResolver } from '@erp/shared/data-access';
import { CatalogClient } from '../../api-client';

/**
 * Resolwer wyników zadań eksportu — zamienia `job.resultRef` (uuid przebiegu) na krótko ważny
 * adres pobrania.
 *
 * <b>Link powstaje dopiero tutaj, w chwili kliknięcia.</b> Backend celowo nie zwraca go
 * w `getExportRun` ani w `JobDto`: presigned URL jest bearer-owy — kto go ma, ten pobiera —
 * więc jego jedynym zabezpieczeniem jest krótki TTL. Adres, który przyjechał razem z listą
 * zadań i przeleżał w pamięci karty pół dnia, tego zabezpieczenia nie ma.
 *
 * <b>Dlaczego fabryka, a nie serwis DI.</b> Woła to `ErpJobResultRegistry`, który żyje
 * w `shared` i nie ma prawa znać typów Catalogu. Fabryka domyka klienta HTTP w zwykłej
 * funkcji, którą rejestr trzyma jako nieprzezroczysty callback.
 */
export function createExportRunResultResolver(injector: Injector): ErpJobResultResolver {
  return async (resultRef: string): Promise<ErpJobResultLink> => {
    const client = runInInjectionContext(injector, () => inject(CatalogClient));

    const response = await firstValueFrom(
      client.getExportRunDownloadUrl({ uuid: resultRef }),
    );

    return { url: response.url, fileName: response.fileName };
  };
}
