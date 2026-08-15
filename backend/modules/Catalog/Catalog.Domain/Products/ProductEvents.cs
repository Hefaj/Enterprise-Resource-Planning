using Erp.BuildingBlocks.Domain;

namespace Catalog.Domain.Products;

/// <summary>
/// Zdarzenia domenowe produktu — fakty biznesowe wewnętrzne dla modułu Catalog.
///
/// Uwaga na zakres: te zdarzenia NIE służą do powiadamiania klientów, że „produkt się zmienił”.
/// Tym zajmuje się automatycznie <c>AggregateChangeScanner</c> na podstawie ChangeTrackera EF,
/// więc żadna komenda nie musi (ani nie powinna) o tym pamiętać. Te zdarzenia istnieją dla
/// reakcji biznesowych — własnych albo w innych modułach, po przetłumaczeniu przez
/// <c>IDomainEventTranslator</c> na kontrakt integracyjny.
/// </summary>
/// <param name="ProductUuid">Produkt, którego dotyczy fakt.</param>
/// <param name="OldPrice">Cena przed zmianą.</param>
/// <param name="NewPrice">Cena po zmianie.</param>
/// <param name="OccurredAt">Moment zmiany.</param>
public sealed record ProductPriceChanged(
    Guid ProductUuid,
    decimal OldPrice,
    decimal NewPrice,
    DateTimeOffset OccurredAt) : IDomainEvent;

/// <param name="ProductUuid">Produkt, którego dotyczy fakt.</param>
/// <param name="OldName">Nazwa przed zmianą.</param>
/// <param name="NewName">Nazwa po zmianie.</param>
/// <param name="OccurredAt">Moment zmiany.</param>
public sealed record ProductNameChanged(
    Guid ProductUuid,
    string OldName,
    string NewName,
    DateTimeOffset OccurredAt) : IDomainEvent;

/// <param name="ProductUuid">Produkt, którego dotyczy fakt.</param>
/// <param name="OldStatus">Status przed zmianą.</param>
/// <param name="NewStatus">Status po zmianie.</param>
/// <param name="OccurredAt">Moment zmiany.</param>
public sealed record ProductStatusChanged(
    Guid ProductUuid,
    ProductStatus OldStatus,
    ProductStatus NewStatus,
    DateTimeOffset OccurredAt) : IDomainEvent;

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
