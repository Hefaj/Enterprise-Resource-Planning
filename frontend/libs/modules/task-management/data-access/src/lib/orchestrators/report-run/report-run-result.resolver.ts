import { Injector, runInInjectionContext, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ErpJobResultLink, ErpJobResultResolver } from '@erp/shared/data-access';
import { TaskManagementClient } from '../../api-client';

/**
 * Resolwer wyników zadań raportu — zamienia `job.resultRef` (uuid przebiegu raportu) na krótko
 * ważny adres pobrania. Kopia `createExportRunResultResolver` z Catalogu, ten sam powód:
 * presigned URL powstaje dopiero w chwili kliknięcia „Pobierz", nie wcześniej.
 */
export function createReportRunResultResolver(injector: Injector): ErpJobResultResolver {
  return async (resultRef: string): Promise<ErpJobResultLink> => {
    const client = runInInjectionContext(injector, () => inject(TaskManagementClient));

    const response = await firstValueFrom(
      client.getReportRunDownloadUrl({ uuid: resultRef }),
    );

    return { url: response.url, fileName: response.fileName };
  };
}
