using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Notification.Domain.Jobs;
using Notification.Infrastructure.Persistence;

namespace Notification.Infrastructure.Consumers;

// CA1822 chce `Handle` statycznego, bo żaden z handlerów nie czyta pola instancji — ale
// konwencja Wolverine wymaga metody INSTANCYJNEJ (tworzy nową instancję handlera per komunikat
// przez DI, żeby dało się wstrzyknąć zależności do konstruktora w przyszłości). Wyłączone
// punktowo w całym pliku, nie globalnie.
#pragma warning disable CA1822

// Konwencja Wolverine: publiczna metoda `Handle`/`HandleAsync` na dowolnej klasie odnalezionej
// przez skanowanie assembly (patrz `Discovery.IncludeAssembly` w AddErpMessaging) staje się
// handlerem komunikatu danego typu — bez rejestracji w DI ani interfejsu do zaimplementowania.
// Parametry dodatkowe (DbContext, IUnitOfWork) Wolverine wstrzykuje ze scope'u per komunikat,
// dokładnie tak jak parametry akcji w kontrolerze ASP.NET.
//
// Utrwalenie repliki (Add/aktualizacja pola + SaveChanges) samo w sobie — przez
// AggregateChangeScanner działający wewnątrz ErpUnitOfWork — generuje kolejne AggregateChanged
// na sygnaturze `notification.job`, publikowane przez WŁASNY outbox Notification. To jest
// zamierzone: ten sam mechanizm automatycznej detekcji zmian, który obsługuje „prawdziwe”
// agregaty biznesowe, obsługuje też tę replikę bez dodatkowego kodu.

/// <summary>Zakłada wiersz repliki, gdy właściciel przyjmie nowe zadanie masowe.</summary>
public sealed class JobAcceptedHandler
{
    public async Task Handle(JobAccepted message, NotificationDbContext db, IUnitOfWork unitOfWork, CancellationToken ct)
    {
        var job = NotificationJob.CreateFromAccepted(
            message.JobUuid,
            message.QueueId,
            message.CommandType,
            message.CommandJson,
            message.TotalCount,
            message.UserId,
            message.ClientId,
            message.UiMetadata,
            message.OccurredAt,
            message.ExpireOn);

        db.NotificationJobs.Add(job);

        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
    }
}

/// <summary>Aktualizuje liczniki repliki po zatwierdzeniu kolejnego chunka.</summary>
public sealed class JobProgressedHandler
{
    public async Task Handle(JobProgressed message, NotificationDbContext db, IUnitOfWork unitOfWork, CancellationToken ct)
    {
        var job = await db.NotificationJobs.FindAsync([message.JobUuid], ct).ConfigureAwait(false);

        // Zdarzenie mogło dotrzeć przed JobAccepted (at-least-once, brak gwarancji kolejności
        // między kolejkami) — cichy powrót jest bezpieczny: JobCompleted i tak nadejdzie
        // z pełnym, ostatecznym stanem.
        if (job is null)
        {
            return;
        }

        job.ApplyProgress(message.Succeeded, message.Failed);

        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
    }
}

/// <summary>Zamyka replikę i powiadamia właściciela zadania kanałem <c>jobs</c>.</summary>
public sealed class JobCompletedHandler
{
    public async Task Handle(
        JobCompleted message,
        NotificationDbContext db,
        IUnitOfWork unitOfWork,
        IIntegrationEventPublisher publisher,
        CancellationToken ct)
    {
        var job = await db.NotificationJobs.FindAsync([message.JobUuid], ct).ConfigureAwait(false);

        if (job is null)
        {
            return;
        }

        job.ApplyCompletion(MapStatus(message.Status), message.Succeeded, message.Failed, message.ErrorsSummary);

        // Kanał `jobs` niesie trackingID zakończonych zadań — to na niego nasłuchuje
        // frontendowy JobService (onUpdate('jobs')), żeby oznaczyć zadanie jako zakończone
        // BEZ odpytywania API. Jest to sygnał odrębny od automatycznego AggregateChanged
        // na sygnaturze `notification.job` (ten dotyczy odświeżenia danych encji Job przez
        // orkiestrator) — oba lecą z tego samego zdarzenia, ale mają różnych odbiorców.
        await publisher.PublishAsync(
            new AggregateChanged(
                AggregateSignatures.Jobs,
                [message.JobUuid],
                ChangeType.Upserted,
                Guid.NewGuid(),
                message.OccurredAt),
            ct).ConfigureAwait(false);

        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
    }

    /// <summary>
    /// Tłumaczy status z kontraktu integracyjnego na typ domenowy repliki. To jedyne miejsce,
    /// gdzie te dwa enumy się spotykają — Domain nie może zależeć od <c>Contracts</c>
    /// (patrz <see cref="NotificationJobStatus"/>), więc konwersja musi żyć w Infrastructure.
    ///
    /// Wartość spoza znanego zbioru (nowsza wersja kontraktu wystawiona przez serwis, którego
    /// jeszcze nie znamy) mapuje się na <see cref="NotificationJobStatus.Completed"/> — zdarzenie
    /// <c>JobCompleted</c> z definicji oznacza koniec, więc lepszym przybliżeniem jest „zakończone”
    /// niż wywalenie handlera i zablokowanie kolejki.
    /// </summary>
    private static NotificationJobStatus MapStatus(JobStatus status) => status switch
    {
        JobStatus.Pending => NotificationJobStatus.Pending,
        JobStatus.Running => NotificationJobStatus.Running,
        JobStatus.Completed => NotificationJobStatus.Completed,
        JobStatus.CompletedWithErrors => NotificationJobStatus.CompletedWithErrors,
        JobStatus.Failed => NotificationJobStatus.Failed,
        JobStatus.Cancelled => NotificationJobStatus.Cancelled,
        _ => NotificationJobStatus.Completed,
    };
}
#pragma warning restore CA1822
