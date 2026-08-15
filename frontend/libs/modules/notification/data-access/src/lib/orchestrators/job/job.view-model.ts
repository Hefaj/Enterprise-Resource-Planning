import { JobMeta, JobRecord } from '@erp/shared/data-access';
import { toJobStatus } from '@erp/notification/util';
import { JobDto } from '../../api-client';

/**
 * ViewModel zadania to wprost `JobRecord` ze `@erp/shared/data-access`.
 *
 * Świadomie bez własnego typu z polami pochodnymi (procent postępu, rodzaj statusu): feed
 * powiadomień scala rekordy z serwera z wpisami optymistycznymi z `JobService`, więc oba
 * źródła MUSZĄ mieć ten sam kształt. Wartości pochodne liczą funkcje z `@erp/notification/util`
 * w momencie renderowania — nie ma sensu ich cache'ować w stanie, skoro zależą wyłącznie
 * od pól, które i tak są w rekordzie.
 */
export type JobVM = JobRecord;

/**
 * Mapuje DTO z API na rekord feedu.
 *
 * `uiMetadata` przyjeżdża jako nieprzezroczysty tekst — to blob, który ten sam frontend
 * wysłał przy zlecaniu operacji masowej (patrz `BatchCommand.UiMetadata`). Parsujemy go tutaj,
 * bo tylko tutaj wiadomo, że w środku siedzi `JobMeta`. Uszkodzona zawartość nie może wywalić
 * całego feedu, więc błąd parsowania kończy się brakiem metadanych, a nie wyjątkiem —
 * wiersz i tak ma się czym opisać (`commandType`).
 */
export function mapJobDtoToRecord(dto: JobDto): JobVM {
  return {
    trackingID: dto.uuid,
    queueID: dto.queueId ?? null,
    commandType: dto.commandType ?? null,
    meta: parseJobMeta(dto.uiMetadata),
    status: toJobStatus(dto.status),
    totalCount: dto.totalCount ?? 0,
    succeededCount: dto.succeededCount ?? 0,
    failedCount: dto.failedCount ?? 0,
    isComplete: dto.isComplete ?? false,
    errorsSummary: dto.errorsSummary ?? null,
    createdAt: dto.createdAt ? new Date(dto.createdAt) : new Date(),
    expireOn: dto.expireOn ? new Date(dto.expireOn) : null,
    changedAt: Date.now(),
    optimistic: false,
  };
}

function parseJobMeta(raw: string | undefined | null): JobMeta | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<JobMeta> & { timestamp?: string | Date };
    if (!parsed?.commandName) {
      return null;
    }

    return {
      commandName: parsed.commandName,
      aggregateUuid: parsed.aggregateUuid,
      timestamp: parsed.timestamp ? new Date(parsed.timestamp) : new Date(),
    };
  } catch {
    return null;
  }
}
