namespace TaskManagement.Domain.Webhooks;

/// <summary>Stan jednego dostarczenia (<see cref="WebhookDelivery"/>). Zamknięty zestaw — nowy
/// stan to zmiana kodu dyspozytora, nie danych.</summary>
public enum WebhookDeliveryStatus
{
    /// <summary>Czeka na próbę albo na kolejną próbę po nieudanej — patrz <c>NextAttemptAt</c>.</summary>
    Pending = 0,

    /// <summary>Odbiorca odpowiedział sukcesem (2xx). Stan końcowy.</summary>
    Sent = 1,

    /// <summary>Wyczerpano <see cref="WebhookDelivery.MaxAttempts"/> bez sukcesu. Stan końcowy —
    /// dyspozytor nie próbuje ponownie, dopiero kolejne zdarzenie tworzy nowe dostarczenie.</summary>
    Failed = 2,
}
