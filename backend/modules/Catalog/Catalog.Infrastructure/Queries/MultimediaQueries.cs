using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Catalog.Application.Multimedia;
using Catalog.Infrastructure.Persistence;
using Erp.BuildingBlocks.Api.Contracts;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Infrastructure.Queries;

// Trzy słownikowe agregaty katalogu. Zebrane w jednym pliku, bo każdy sprowadza się do tej
// samej pary „szukaj + pobierz po uuid" i rozbijanie ich na osobne pliki dałoby trzy niemal
// identyczne szkielety zamiast czytelnego porównania.

/// <summary>Odczyty zasobów multimedialnych.</summary>
public sealed class MultimediaQueries : IMultimediaQueries
{
    private readonly CatalogDbContext _dbContext;

    public MultimediaQueries(CatalogDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public async Task<SearchResponse> SearchAsync(
        SearchMultimediaRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _dbContext.MultimediaAssets.AsNoTracking();

        if (request.Uuids is { Count: > 0 })
        {
            var uuidList = request.Uuids;
            query = query.Where(m => uuidList.Contains(m.Uuid));
        }

        var totalCount = await query.CountAsync(cancellationToken).ConfigureAwait(false);

        var descending = request.Sorts?.FirstOrDefault()?.Order == -1;
        var ordered = descending
            ? query.OrderByDescending(m => m.SortOrder)
            : query.OrderBy(m => m.SortOrder);

        var uuids = await ordered
            .ThenBy(m => m.Uuid)
            .Skip((Math.Max(request.Page, 1) - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(m => m.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new SearchResponse { Uuids = uuids, TotalCount = totalCount };
    }

    /// <inheritdoc />
    public async Task<List<MultimediaDto>> GetAsync(
        IReadOnlyCollection<Guid>? uuids,
        CancellationToken cancellationToken)
    {
        var query = _dbContext.MultimediaAssets.AsNoTracking();

        if (uuids is { Count: > 0 })
        {
            var uuidList = uuids.ToList();
            query = query.Where(m => uuidList.Contains(m.Uuid));
        }

        // `CreatedAt` schodzi z bazy jako DateTimeOffset i dopiero w pamięci ląduje w DateTime
        // z kontraktu DTO: wywołanie `.UtcDateTime` wprost w projekcji EF wywraca shaper
        // („No coercion operator ... between DateTimeOffset and Nullable<DateTime>").
        var rows = await query
            .Select(m => new
            {
                m.Uuid,
                m.FileName,
                m.MediaType,
                m.ThumbnailUrl,
                m.OriginalUrl,
                m.FileSize,
                m.MimeType,
                m.SortOrder,
                m.CreatedAt,
            })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return rows
            .Select(m => new MultimediaDto(
                m.Uuid,
                m.FileName,
                m.MediaType,
                m.ThumbnailUrl,
                m.OriginalUrl,
                m.FileSize,
                m.MimeType,
                m.SortOrder,
                m.CreatedAt.UtcDateTime))
            .ToList();
    }

    /// <inheritdoc />
    public async Task<List<Guid>> GetExistingUuidsAsync(
        IReadOnlyCollection<Guid> uuids,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(uuids);

        if (uuids.Count == 0)
        {
            return [];
        }

        var uuidList = uuids as List<Guid> ?? uuids.ToList();

        return await _dbContext.MultimediaAssets
            .AsNoTracking()
            .Where(m => uuidList.Contains(m.Uuid))
            .Select(m => m.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<Guid?> GetArtifactUuidAsync(Guid uuid, CancellationToken cancellationToken)
        => await _dbContext.MultimediaAssets
            .AsNoTracking()
            .Where(m => m.Uuid == uuid)
            .Select(m => m.ArtifactUuid)
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);
}
