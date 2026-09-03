using TaskManagement.Domain.Automation;

namespace TaskManagement.Application.Automation;

/// <summary>
/// Akcja reguły na wejściu komendy. <see cref="ConfigJson"/> jest opaque dla backendu w tym
/// samym sensie co <c>SavedView.FilterJson</c> — kształt zależy od <see cref="Kind"/> i go
/// interpretuje dopiero silnik wykonawczy przy próbie wykonania, nie ten kontrakt. Błędny
/// kształt nie odrzuca zapisu reguły (AC1 nie tego dotyczy — zamknięta jest lista RODZAJÓW akcji,
/// nie ich parametrów), tylko kończy pojedyncze uruchomienie jako <c>AutomationRun.Failed</c>.
/// </summary>
public sealed class AutomationActionRequest
{
    /// <summary>Uuid generowany przez klienta.</summary>
    public Guid Uuid { get; set; }

    public AutomationActionKind Kind { get; set; }

    public string? ConfigJson { get; set; }

    public int OrderNo { get; set; }
}
