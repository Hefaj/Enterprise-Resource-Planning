import { Injectable, computed, inject, signal } from '@angular/core';
import { ErpJobResultRegistry, JobRecord } from '@erp/shared/data-access';

/**
 * Zamienia zakończone zadanie na pobrany plik.
 *
 * <b>Dlaczego osobny serwis, a nie metoda w komponencie.</b> Tę samą akcję obsługuje popover
 * pod dzwonkiem i tabela w historii zadań; obie potrzebują też stanu „trwa pobieranie", żeby
 * jedno kliknięcie nie zamieniło się w pięć równoległych żądań o link.
 *
 * <b>Adres nie jest nigdzie zapamiętywany.</b> Presigned URL jest bearer-owy i ważny minuty —
 * pobieramy go w chwili kliknięcia i od razu zużywamy. Trzymanie go w rekordzie zadania
 * oznaczałoby, że leży w pamięci karty długo po tym, jak przestał być komukolwiek potrzebny.
 */
@Injectable({ providedIn: 'root' })
export class JobDownloadService {
  private readonly _registry = inject(ErpJobResultRegistry);
  private readonly _pending = signal(new Set<string>());

  /** Zadania, dla których trwa właśnie pobieranie linku. */
  public readonly pending = computed(() => this._pending());

  /**
   * Czy dla tego zadania da się pokazać akcję pobrania.
   *
   * Trzy warunki, wszystkie konieczne: zadanie wskazało artefakt, ktoś w ogóle potrafi ten typ
   * komendy obsłużyć (patrz {@link ErpJobResultRegistry}), i artefakt jeszcze nie wygasł.
   * Ostatni warunek jest po to, żeby nie rysować przycisku prowadzącego do 404 — retencja
   * artefaktu i `expireOn` zadania pochodzą po stronie backendu z jednej wartości.
   */
  public canDownload(job: JobRecord): boolean {
    if (!job.resultRef || !this._registry.canResolve(job.commandType)) {
      return false;
    }

    return !job.expireOn || job.expireOn.getTime() > Date.now();
  }

  public isDownloading(job: JobRecord): boolean {
    return this._pending().has(job.trackingID);
  }

  /** Pobiera link i uruchamia pobieranie. Zwraca `false`, gdy się nie udało. */
  public async download(job: JobRecord): Promise<boolean> {
    if (!job.resultRef || !job.commandType || this.isDownloading(job)) {
      return false;
    }

    this._mark(job.trackingID, true);

    try {
      const link = await this._registry.resolve(job.commandType, job.resultRef);
      if (!link) {
        return false;
      }

      triggerBrowserDownload(link.url, link.fileName);
      return true;
    } finally {
      this._mark(job.trackingID, false);
    }
  }

  private _mark(trackingID: string, active: boolean): void {
    this._pending.update(current => {
      const next = new Set(current);

      if (active) {
        next.add(trackingID);
      } else {
        next.delete(trackingID);
      }

      return next;
    });
  }
}

/**
 * Uruchamia pobieranie w przeglądarce.
 *
 * Atrybut `download` jest ignorowany dla adresów cross-origin (a presigned URL prowadzi wprost
 * do magazynu, nie do naszego API), więc nazwę pliku i tak narzuca `Content-Disposition`
 * po stronie magazynu. Zostaje tu jako podpowiedź dla przypadku, w którym pobranie idzie przez
 * proxy tego samego pochodzenia.
 */
function triggerBrowserDownload(url: string, fileName: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
