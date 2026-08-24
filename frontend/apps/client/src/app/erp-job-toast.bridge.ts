import { Injectable, effect, inject, untracked } from '@angular/core';
import { ErpJobResultRegistry, JobRecord, JobService } from '@erp/shared/data-access';
import { ErpToastService, SHARED_KEYS, Translatable } from '@erp/shared/ui';

/**
 * Zamienia zakończone zadanie masowe w toast — dla zadań, które o to poprosiły
 * (`JobMeta.notifyOnComplete`).
 *
 * <b>Dlaczego w hoście.</b> Źródłem jest `JobService` z `shared/data-access`, celem
 * `ErpToastService` z `shared/ui`, a te dwie biblioteki nie mogą się nawzajem widzieć
 * (granice NX: `type:data-access` → `{data-access, util}`, `type:ui` → `{ui, util}`).
 * Host jest jedyną warstwą, która widzi obie — tak samo jak przy dzwonku powiadomień
 * i rejestrze wyników zadań.
 *
 * <b>Dlaczego nie w remocie `notification`.</b> Jego warstwa `feature` ładuje się leniwie,
 * dopiero gdy ktoś otworzy panel albo historię. Toast po zakończeniu długiego eksportu ma
 * przyjść niezależnie od tego, gdzie użytkownik akurat jest.
 */
@Injectable({ providedIn: 'root' })
export class ErpJobToastBridge {
  private readonly _jobService = inject(JobService);
  private readonly _toasts = inject(ErpToastService);
  private readonly _results = inject(ErpJobResultRegistry);

  /**
   * Zadania, dla których toast już poszedł.
   *
   * Konieczne, bo rekord zadania zmienia się jeszcze po zakończeniu (kanał `jobs` oznacza
   * `isComplete` natychmiast, a dokładny status dochodzi chwilę później z repliki) — bez tego
   * jedno zakończenie dawałoby dwa albo trzy identyczne toasty.
   */
  private readonly _notified = new Set<string>();

  public constructor() {
    effect(() => {
      const jobs = this._jobService.jobs();

      untracked(() => {
        for (const job of jobs) {
          this._maybeNotify(job);
        }
      });
    });
  }

  private _maybeNotify(job: JobRecord): void {
    if (!job.isComplete || !job.meta?.notifyOnComplete || this._notified.has(job.trackingID)) {
      return;
    }

    // Czekamy na rozstrzygnięty status: `isComplete` przychodzi kanałem `jobs` PRZED
    // dokładnym stanem z repliki, a toast „zakończono" przy zadaniu, które właśnie poległo,
    // byłby zmyśleniem sukcesu.
    if (job.status === 'pending' || job.status === 'running') {
      return;
    }

    this._notified.add(job.trackingID);

    const name = job.meta?.commandName ?? job.commandType ?? '';

    this._toasts.show({
      id: `job-${job.trackingID}`,
      message: this._messageFor(job, name),
      appearance: this._appearanceFor(job),
      action: this._canDownload(job)
        ? {
            label: SHARED_KEYS.jobs.toast.download,
            fn: () => this._download(job),
          }
        : undefined,
    });
  }

  private _messageFor(job: JobRecord, name: Translatable): Translatable {
    const params = { name: typeof name === 'string' ? name : name.key };

    if (job.status === 'failed') {
      return { key: SHARED_KEYS.jobs.toast.failed, params };
    }

    if (job.failedCount > 0) {
      return { key: SHARED_KEYS.jobs.toast.completedWithErrors, params };
    }

    return { key: SHARED_KEYS.jobs.toast.completed, params };
  }

  private _appearanceFor(job: JobRecord): 'positive' | 'warning' | 'negative' {
    if (job.status === 'failed') {
      return 'negative';
    }

    return job.failedCount > 0 ? 'warning' : 'positive';
  }

  /**
   * Ta sama trójka warunków co przy przycisku w feedzie (patrz `JobDownloadService`):
   * zadanie wskazało artefakt, ktoś potrafi ten typ komendy obsłużyć, artefakt nie wygasł.
   */
  private _canDownload(job: JobRecord): boolean {
    if (!job.resultRef || !this._results.canResolve(job.commandType)) {
      return false;
    }

    return !job.expireOn || job.expireOn.getTime() > Date.now();
  }

  private async _download(job: JobRecord): Promise<void> {
    if (!job.resultRef || !job.commandType) {
      return;
    }

    const link = await this._results.resolve(job.commandType, job.resultRef);
    if (!link) {
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = link.url;
    anchor.download = link.fileName;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }
}
