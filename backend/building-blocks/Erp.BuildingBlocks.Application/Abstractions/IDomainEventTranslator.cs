using Erp.BuildingBlocks.Domain;

namespace Erp.BuildingBlocks.Application.Abstractions;

/// <summary>
/// Tłumaczy zdarzenie domenowe (wewnętrzne dla modułu) na zero lub więcej zdarzeń integracyjnych
/// (publiczny, wersjonowany kontrakt). To jest miejsce, w którym przebiega granica modułu.
///
/// Uwaga na zakres odpowiedzialności: samo „ten agregat się zmienił” <b>nie przechodzi tędy</b> —
/// zajmuje się tym <see cref="IAggregateSignatureMap"/> i skan ChangeTrackera, automatycznie.
/// Translator jest dla faktów biznesowych, na które ma zareagować <i>inny moduł</i>
/// (np. „produkt wycofany ze sprzedaży” → Sales ma zamknąć otwarte oferty).
///
/// Zwrócenie pustej sekwencji jest normalne i oznacza „to zdarzenie nie opuszcza modułu”.
/// </summary>
public interface IDomainEventTranslator
{
    /// <summary>Zamienia zdarzenie domenowe na zdarzenia integracyjne do publikacji.</summary>
    IEnumerable<object> Translate(IDomainEvent domainEvent, IExecutionContext executionContext);
}
