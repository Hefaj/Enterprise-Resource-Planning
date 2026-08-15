using System;
using System.Collections.Generic;

namespace Erp.BuildingBlocks.Api.Contracts;

/// <summary>
/// Żądanie operacji masowej: co wykonać (<see cref="Commands"/> albo <see cref="TemplateCommand"/>)
/// i na czym (<see cref="TargetUuids"/> albo <see cref="TargetFilter"/>) — patrz
/// <c>BatchEndpointBase.ResolveTargetsAsync</c>.
/// </summary>
public class BatchCommand<TCommand, TFilter> where TCommand : IAggregateCommand
{
    public List<TCommand>? Commands { get; set; }
    public TCommand? TemplateCommand { get; set; }
    public List<Guid>? TargetUuids { get; set; }
    public TFilter? TargetFilter { get; set; }

    /// <summary>
    /// Identyfikator wywołującego — po stronie frontendu jest to identyfikator modalu, z którego
    /// poszła operacja. Wraca w <c>JobDto.QueueId</c> i pozwala zgrupować powiadomienia
    /// („5 zadań z modalu zmiany ceny”) oraz otworzyć ten sam modal przy ponowieniu.
    ///
    /// Backend traktuje wartość jako nieprzezroczystą etykietę — nigdy jej nie parsuje.
    /// </summary>
    public string? QueueId { get; set; }

    /// <summary>
    /// Blob metadanych frontendu (klucz tłumaczenia komendy, kontekst modalu), przenoszony
    /// bez zmian do <c>JobAccepted.UiMetadata</c> i dalej do repliki w Notification.
    ///
    /// Istnieje, bo backend zna wyłącznie techniczną nazwę typu komendy
    /// (<c>ProductSetPriceCommand</c>), a powiadomienie ma pokazać zdanie w języku użytkownika.
    /// Tłumaczenie nazwy komendy na tekst jest wiedzą frontendu i tam zostaje — backend
    /// przechowuje ją jako <c>jsonb</c>, którego nigdy nie interpretuje.
    /// </summary>
    public string? UiMetadata { get; set; }
}
