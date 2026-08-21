using System;
using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;

namespace Catalog.Application.Products;

/// <summary>
/// Utworzenie produktu — minimalny zestaw: nazwa i cena. Reszta pól agregatu (status, model,
/// kategorie, kody, atrybuty) ma sensowne wartości domyślne albo dostaje je osobną komendą,
/// więc nie wchodzi do kontraktu zakładania.
///
/// <para><b>Uuid generuje klient.</b> Tworzenie ma sens wyłącznie w trybie <c>Commands[]</c>
/// kontraktu <see cref="BatchCommand{TCommand, TFilter}"/> — agregat jeszcze nie istnieje,
/// więc nie ma czego wskazać ani filtrem, ani listą identyfikatorów. Identyfikator nadany
/// z góry przez klienta pozwala mimo to zapisać każdą pozycję jako <c>job_item</c> z własnym
/// <c>aggregate_uuid</c>, czyli raportować sukces i porażkę per pozycja tak samo jak przy
/// operacjach na istniejących produktach (tak samo robi to <c>RoleCreateCommand</c>).</para>
/// </summary>
public sealed class ProductCreateCommand : ICommand<Guid>, IAggregateCommand
{
    /// <inheritdoc />
    public Guid Uuid { get; set; }

    public string Name { get; set; } = string.Empty;

    public decimal Price { get; set; }
}
