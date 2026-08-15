namespace Notification.Domain.Jobs;

/// <summary>
/// Status zadania w replice read-modelu.
///
/// Celowo <b>osobny typ</b> od <c>Erp.BuildingBlocks.Contracts.JobStatus</c>, mimo identycznego
/// zestawu wartości: Domain nie może zależeć od kontraktów integracyjnych (wymusza to test
/// <c>Domain_nie_zalezy_od_kontraktow_integracyjnych</c> w <c>Erp.ArchitectureTests</c>).
/// Tłumaczenie jednego na drugie żyje w Infrastructure, przy konsumencie zdarzenia — czyli
/// dokładnie tam, gdzie kończy się świat kontraktu, a zaczyna model wewnętrzny.
///
/// Kolejność wartości jest utrwalana w bazie jako <c>int</c> — nie przenumerowywać.
/// </summary>
public enum NotificationJobStatus
{
    /// <summary>Przyjęte, żaden chunk jeszcze nie wrócił.</summary>
    Pending = 0,

    /// <summary>W trakcie — co najmniej jeden chunk zatwierdzony.</summary>
    Running = 1,

    /// <summary>Zakończone, wszystkie elementy powiodły się.</summary>
    Completed = 2,

    /// <summary>Zakończone, ale część elementów zawiodła.</summary>
    CompletedWithErrors = 3,

    /// <summary>Nie udało się wykonać w ogóle.</summary>
    Failed = 4,

    /// <summary>Anulowane przez użytkownika.</summary>
    Cancelled = 5,
}
