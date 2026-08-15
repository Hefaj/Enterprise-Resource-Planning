using System;
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
