using System;
using System.Collections.Generic;
using Catalog.Application.Abstractions;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;

namespace Catalog.Application.Products;

/// <summary>
/// Zmiana klasyfikacji produktu — modelu i kompletu kategorii naraz.
///
/// Obie wartości w jednej komendzie, bo razem tworzą sygnaturę duplikatu: rozdzielone
/// dawałyby stan pośredni (nowy model, stare kategorie), który musiałby przejść przez
/// unikalny indeks, choć nikt takiej klasyfikacji nie chciał.
/// </summary>
public sealed class ProductSetClassificationCommand : ICommand<Guid>, IAggregateCommand
{
    /// <inheritdoc />
    public Guid Uuid { get; set; }

    /// <summary>Model, którego wariantem ma być produkt; <c>null</c> czyni go samodzielnym.</summary>
    public Guid? ModelUuid { get; set; }

    /// <summary>Komplet kategorii — podmiana, nie dopisanie.</summary>
    public List<Guid> CategoryUuids { get; set; } = [];
}
