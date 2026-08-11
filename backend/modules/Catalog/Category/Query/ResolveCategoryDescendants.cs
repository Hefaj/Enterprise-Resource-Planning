using FastEndpoints;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Catalog.Category.Query;

public class ResolveCategoryDescendantsRequest
{
    /// <summary>Korzenie poddrzew do rozwinięcia (garść wartości).</summary>
    public List<Guid> Uuids { get; set; } = new();
}

public class ResolveCategoryDescendantsResponse
{
    public List<Guid> Uuids { get; set; } = new();
    /// <summary>`true`, gdy wynik uciął się na limicie (patrz <see cref="ResolveCategoryDescendantsEndpoint.Limit"/>)
    /// i nie zawiera WSZYSTKICH potomków zażądanych korzeni.</summary>
    public bool Truncated { get; set; }
}

/// <summary>
/// Furtka awaryjna: rozwija zaznaczenie poddrzewa (deskryptor `{ subtreeRoots, excluded }`) do
/// płaskiej listy uuid jednym wywołaniem — dla wywołujących, którzy potrzebują konkretnej listy
/// identyfikatorów zamiast przekazywać dalej sam deskryptor selekcji. Odpowiednik docelowego
/// `POST /api/catalog/categories/resolve-descendants`.
/// </summary>
public class ResolveCategoryDescendantsEndpoint : Endpoint<ResolveCategoryDescendantsRequest, ResolveCategoryDescendantsResponse>
{
    public const int Limit = 10_000;

    public override void Configure()
    {
        Post("resolveCategoryDescendants");
        Group<CategoryGroup>();
    }

    public override async Task HandleAsync(ResolveCategoryDescendantsRequest req, CancellationToken ct)
    {
        await CatalogMockData.SimulateQueryDelayAsync(ct);

        var result = new HashSet<Guid>();
        var truncated = false;

        void Collect(Guid uuid)
        {
            if (result.Count >= Limit)
            {
                truncated = true;
                return;
            }
            if (!result.Add(uuid))
                return;

            foreach (var child in CatalogMockData.CategoryChildren[uuid])
                Collect(child.Uuid);
        }

        foreach (var uuid in req.Uuids)
            Collect(uuid);

        await Send.OkAsync(new ResolveCategoryDescendantsResponse { Uuids = result.ToList(), Truncated = truncated }, ct);
    }
}
