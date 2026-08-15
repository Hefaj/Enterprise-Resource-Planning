using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Catalog.Application.Contracts;
using Catalog.Domain.Attributes;
using Catalog.Infrastructure.Persistence;
using Erp.BuildingBlocks.Api.Contracts;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Infrastructure.Queries;

/// <summary>Odczyty słownika definicji atrybutów.</summary>
public sealed class AttributeQueries : IAttributeQueries
{
    private readonly CatalogDbContext _dbContext;

    public AttributeQueries(CatalogDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public async Task<SearchResponse> SearchAsync(
        SearchAttributeRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _dbContext.AttributeDefinitions.AsNoTracking();

        if (request.AttributeId.HasValue)
        {
            query = query.Where(a => a.Uuid == request.AttributeId.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            var name = request.Name;
            query = query.Where(a => EF.Functions.ILike(a.Name, $"%{name}%")
                                  || EF.Functions.ILike(a.Code, $"%{name}%"));
        }

        if (!string.IsNullOrWhiteSpace(request.Kind))
        {
            // Nierozpoznany rodzaj zwraca pustkę, a nie cały słownik: filtr, którego backend
            // nie rozumie, nie może po cichu zamienić się w jego brak.
            var kind = ParseKind(request.Kind);
            query = kind is null ? query.Where(_ => false) : query.Where(a => a.Kind == kind);
        }

        var totalCount = await query.CountAsync(cancellationToken).ConfigureAwait(false);

        var descending = request.Sorts?.FirstOrDefault()?.Order == -1;
        var ordered = descending
            ? query.OrderByDescending(a => a.SortOrder).ThenByDescending(a => a.Name)
            : query.OrderBy(a => a.SortOrder).ThenBy(a => a.Name);

        var uuids = await ordered
            .ThenBy(a => a.Uuid)
            .Skip((Math.Max(request.Page, 1) - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(a => a.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new SearchResponse { Uuids = uuids, TotalCount = totalCount };
    }

    /// <inheritdoc />
    public async Task<List<AttributeDefinitionDto>> GetAsync(
        IReadOnlyCollection<Guid>? uuids,
        CancellationToken cancellationToken)
    {
        var query = _dbContext.AttributeDefinitions.AsNoTracking();

        if (uuids is { Count: > 0 })
        {
            var uuidList = uuids.ToList();
            query = query.Where(a => uuidList.Contains(a.Uuid));
        }

        // Dwa kroki, a nie jedna projekcja: enumy jadą z bazy jako enumy i dopiero w pamięci
        // dostają wartość kontraktu z `AttributeNames`. Wciśnięcie tego tłumaczenia w wyrażenie
        // SQL-owe wymagałoby zagnieżdżonych warunków po każdej pozycji dwóch enumów — nieczytelnych
        // i, co gorsza, będących drugą kopią mapowania, które już jest w jednym miejscu.
        // Słownik ma kilkanaście wierszy, więc kroku po stronie klienta nie widać.
        var rows = await query
            .Select(a => new
            {
                a.Uuid,
                a.Code,
                a.Name,
                a.Kind,
                a.DataType,
                a.IsMultiValue,
                a.SortOrder,
                Options = EF.Property<List<AttributeOption>>(a, "_options")
                    .OrderBy(o => o.SortOrder)
                    .Select(o => new AttributeOptionDto(o.Uuid, o.Code, o.Name, o.SortOrder))
                    .ToList(),
            })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return [.. rows.Select(a => new AttributeDefinitionDto(
            a.Uuid,
            a.Code,
            a.Name,
            a.Kind.ToContract(),
            a.DataType.ToContract(),
            a.IsMultiValue,
            a.SortOrder,
            a.Options))];
    }

    /// <summary>
    /// Zamienia wartość kontraktu na pozycję enuma. Rozgałęzienie po stałych z
    /// <see cref="AttributeNames"/>, a nie <c>Enum.TryParse</c>: parsowanie po nazwie pozycji
    /// C# przypadkiem działa dopóki nazwa i wartość kontraktu są takie same, a przestaje
    /// w dniu, w którym ktoś przemianuje pozycję enuma.
    /// </summary>
    private static AttributeKind? ParseKind(string kind) => kind.Trim() switch
    {
        AttributeNames.KindDictionary => AttributeKind.Dictionary,
        AttributeNames.KindValue => AttributeKind.Value,
        AttributeNames.KindMultimedia => AttributeKind.Multimedia,
        _ => null,
    };
}
