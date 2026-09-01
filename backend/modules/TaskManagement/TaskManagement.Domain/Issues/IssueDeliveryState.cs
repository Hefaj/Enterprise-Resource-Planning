namespace TaskManagement.Domain.Issues;

/// <summary>
/// Stan realizacji zlecenia, wyliczany z zamknięć zgłoszeń wykonawczych powiązanych
/// przez <see cref="IssueLinkType.Delivers"/> (REQ-003).
///
/// <para>Wyłącznie <b>wyliczony</b>, nie ustawiany wprost przez użytkownika — zlecenie samo się
/// nie zamyka, tylko przełącza ten wskaźnik; zamknięcie zlecenia jest zawsze decyzją człowieka
/// (odbiór), nigdy skutkiem ubocznym zamknięcia ostatniej realizacji.</para>
/// </summary>
public enum IssueDeliveryState
{
    /// <summary>Zgłoszenie nie jest zleceniem albo nie ma jeszcze żadnej realizacji.</summary>
    None = 0,

    /// <summary>Co najmniej jedna realizacja jest jeszcze otwarta.</summary>
    InProgress = 1,

    /// <summary>Wszystkie realizacje są zamknięte — zlecenie czeka na odbiór.</summary>
    Delivered = 2,
}
