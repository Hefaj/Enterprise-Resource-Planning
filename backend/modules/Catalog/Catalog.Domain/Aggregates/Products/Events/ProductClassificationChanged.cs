using System;
using System.Collections.Generic;
using Erp.BuildingBlocks.Domain;

namespace Catalog.Domain.Products;

/// <summary>
/// Zmiana klasyfikacji produktu — modelu i/lub kompletu kategorii. Jedno zdarzenie na obie
/// rzeczy naraz, bo razem tworzą sygnaturę duplikatu (<see cref="Product.DuplicateKey"/>)
/// i rozdzielenie ich dawałoby moment, w którym produkt ma nowy model i stare kategorie.
/// </summary>
/// <param name="ProductUuid">Produkt, którego dotyczy fakt.</param>
/// <param name="OldModelUuid">Model przed zmianą.</param>
/// <param name="NewModelUuid">Model po zmianie.</param>
/// <param name="OldCategoryUuids">Kategorie przed zmianą.</param>
/// <param name="NewCategoryUuids">Kategorie po zmianie.</param>
/// <param name="OccurredAt">Moment zmiany.</param>
public sealed record ProductClassificationChanged(
    Guid ProductUuid,
    Guid? OldModelUuid,
    Guid? NewModelUuid,
    IReadOnlyCollection<Guid> OldCategoryUuids,
    IReadOnlyCollection<Guid> NewCategoryUuids,
    DateTimeOffset OccurredAt) : IDomainEvent;
