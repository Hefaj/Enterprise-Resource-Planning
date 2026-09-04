namespace TaskManagement.Domain.Issues;

/// <summary>
/// Rodzaj powiązania między zgłoszeniami (<c>docs/modules/task-management/domain.md</c> §8.1).
///
/// <para>Powiązanie to <b>graf</b> i coś zupełnie innego niż hierarchia
/// (<c>issue.parent_uuid</c>, drzewo z jednym rodzicem). Trzymanie obu w jednej tabeli
/// („rodzic to link typu subtask") kusi, ale rodzic ma inne reguły: wpływa na agregację
/// postępu, na widok drzewa i na zamykanie. Jedna tabela znaczyłaby <c>WHERE type = 'subtask'</c>
/// w każdym z tych zapytań i brak indeksu, który by je obsłużył.</para>
/// </summary>
public enum IssueLinkType
{
    /// <summary>Źródło blokuje cel. <b>Jedyny typ, który musi być acykliczny</b> — reszta opisuje
    /// relacje bez kierunku wykonania, więc pętla w nich nikomu nie przeszkadza.</summary>
    Blocks = 0,

    /// <summary>Źródło duplikuje cel.</summary>
    Duplicates = 1,

    /// <summary>Zgłoszenia dotyczą się nawzajem — najsłabszy z typów i celowo bez reguł.</summary>
    Relates = 2,

    /// <summary>Zgłoszenie wykonawcze realizuje zlecenie. <b>Typ zarezerwowany dla fazy 5</b>
    /// (§9): to po nim liczy się <c>derived_delivery_state</c> zlecenia, więc nie wolno go
    /// używać jako „zwykłego" powiązania.</summary>
    Delivers = 3,
}
