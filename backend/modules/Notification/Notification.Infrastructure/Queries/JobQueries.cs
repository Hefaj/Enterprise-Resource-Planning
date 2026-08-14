using Erp.BuildingBlocks.Api.Contracts;
using Microsoft.EntityFrameworkCore;
using Notification.Application.Contracts;
using Notification.Infrastructure.Persistence;

namespace Notification.Infrastructure.Queries;

/// <summary>
/// Odczyty repliki zadań, bezpośrednio na EF Core.
///
/// Mapowanie na <see cref="JobDto"/> jest celowo asymetryczne względem starego mocka: pola,
/// dla których backend nie ma realnej wartości (bo nasz model zdarzeń jej nie niesie), dostają
/// uczciwe <c>null</c>/wartość domyślną zamiast fabrykowanych danych. Zobacz komentarze przy
/// każdym takim polu.
/// </summary>
public sealed class JobQueries : IJobQueries
{
    private readonly NotificationDbContext _dbContext;

    public JobQueries(NotificationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    public async Task<SearchResponse> SearchAsync(SearchJobRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _dbContext.NotificationJobs.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.QueueId))
        {
            var term = request.QueueId;
            query = query.Where(j => j.QueueId != null && EF.Functions.ILike(j.QueueId, $"%{term}%"));
        }

        if (!string.IsNullOrWhiteSpace(request.TrackingId))
        {
            var term = request.TrackingId;
            query = query.Where(j => EF.Functions.ILike(j.TrackingId, $"%{term}%"));
        }

        if (request.IsComplete.HasValue)
        {
            query = query.Where(j => j.IsComplete == request.IsComplete.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.UserId))
        {
            var term = request.UserId;
            query = query.Where(j => j.UserId != null && EF.Functions.ILike(j.UserId, $"%{term}%"));
        }

        var totalCount = await query.CountAsync(cancellationToken).ConfigureAwait(false);

        var uuids = await ApplySorting(query, request)
            .Skip((Math.Max(request.Page, 1) - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(j => j.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new SearchResponse { Uuids = uuids, TotalCount = totalCount };
    }

    /// <inheritdoc />
    public async Task<List<JobDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken)
    {
        var query = _dbContext.NotificationJobs.AsNoTracking();

        if (uuids is { Count: > 0 })
        {
            var uuidList = uuids.ToList();
            query = query.Where(j => uuidList.Contains(j.Uuid));
        }

        return await query
            .Select(j => new JobDto(
                j.Uuid,
                j.QueueId,
                j.TrackingId,
                j.CommandJson,
                // ResultJson/ResultType: backend nie przechowuje wyniku pojedynczego zadania
                // jako osobnego payloadu — wynik to liczniki (SucceededCount/FailedCount)
                // i ErrorsSummary. Zostają null, zamiast fabrykować treść, której nikt nie zapisał.
                null,
                null,
                j.ErrorsSummary,
                // Successes: syntetyzowane z liczników, żeby pole niosło realną informację
                // („3/5 zakończonych powodzeniem”), a nie sztywny napis z poprzedniego mocka.
                j.SucceededCount > 0 ? j.SucceededCount + "/" + j.TotalCount + " zakończonych powodzeniem" : null,
                // Exceptions: w naszym modelu wyjątek infrastrukturalny i naruszenie reguły
                // trafiają do tego samego ErrorsSummary — nie rozróżniamy ich na poziomie repliki.
                null,
                j.IsComplete,
                // UnRead: koncept czysto kliencki (JobService oznacza zadanie jako nieprzeczytane
                // lokalnie przy rejestracji) — backend nie ma endpointu „oznacz jako przeczytane”,
                // więc replika zawsze zwraca `true` i klient zarządza tym stanem sam.
                true,
                // ExecutionTimes/ServiceId: pola bez odpowiednika w obecnym modelu zadań
                // (nie licznik prób pojedynczego elementu, tylko coś z zewnętrznego schedulera
                // z poprzedniej generacji mocka) — zerowa/pusta wartość, nie fabrykacja.
                0,
                null,
                j.UserId,
                j.ClientId,
                j.UiMetadata,
                j.CreatedAt.UtcDateTime,
                j.ExpireOn == null ? null : j.ExpireOn.Value.UtcDateTime))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <summary>Sortowanie po polach dopuszczonych przez kontrakt — whitelist, nie dynamiczne
    /// wyrażenie z nazwy pola żądania (patrz uzasadnienie w <c>Catalog ProductQueries</c>).</summary>
    private static IQueryable<Domain.Jobs.NotificationJob> ApplySorting(
        IQueryable<Domain.Jobs.NotificationJob> query,
        SearchJobRequest request)
    {
        if (request.Sorts is null || request.Sorts.Count == 0)
        {
            return query.OrderByDescending(j => j.CreatedAt).ThenBy(j => j.Uuid);
        }

        IOrderedQueryable<Domain.Jobs.NotificationJob>? ordered = null;

        foreach (var sort in request.Sorts)
        {
            var descending = sort.Order == -1;

            ordered = sort.Field.ToUpperInvariant() switch
            {
                "QUEUEID" => Chain(ordered, query, j => j.QueueId, descending),
                "TRACKINGID" => Chain(ordered, query, j => j.TrackingId, descending),
                "ISCOMPLETE" => Chain(ordered, query, j => j.IsComplete, descending),
                "USERID" => Chain(ordered, query, j => j.UserId, descending),
                "EXECUTEAFTER" => Chain(ordered, query, j => j.CreatedAt, descending),
                "EXPIREON" => Chain(ordered, query, j => j.ExpireOn, descending),
                _ => ordered,
            };
        }

        return ordered is null
            ? query.OrderByDescending(j => j.CreatedAt).ThenBy(j => j.Uuid)
            : ordered.ThenBy(j => j.Uuid);
    }

    private static IOrderedQueryable<Domain.Jobs.NotificationJob> Chain<TKey>(
        IOrderedQueryable<Domain.Jobs.NotificationJob>? ordered,
        IQueryable<Domain.Jobs.NotificationJob> query,
        System.Linq.Expressions.Expression<Func<Domain.Jobs.NotificationJob, TKey>> selector,
        bool descending)
    {
        if (ordered is null)
        {
            return descending ? query.OrderByDescending(selector) : query.OrderBy(selector);
        }

        return descending ? ordered.ThenByDescending(selector) : ordered.ThenBy(selector);
    }
}
