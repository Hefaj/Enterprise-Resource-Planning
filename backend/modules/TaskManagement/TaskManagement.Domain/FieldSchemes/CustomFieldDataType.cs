namespace TaskManagement.Domain.FieldSchemes;

/// <summary>
/// Typ danych pola niestandardowego. Zbiór jest <b>zamknięty i mały</b> celowo: każdy typ musi
/// mieć swoją pulę slotów sortowalnych (<see cref="FieldSlot"/>), więc dołożenie typu to
/// migracja tabeli <c>issue</c>, a nie wpis w słowniku.
/// </summary>
public enum CustomFieldDataType
{
    /// <summary>Tekst swobodny. Slot <c>text_1..text_4</c>.</summary>
    Text = 0,

    /// <summary>Liczba (dziesiętna). Slot <c>num_1..num_4</c>.</summary>
    Number = 1,

    /// <summary>Data z czasem. Slot <c>date_1..date_4</c>.</summary>
    Date = 2,

    /// <summary>Użytkownik. Slot <c>user_1..user_2</c> — jedyne rozszerzenie względem DMS,
    /// bo „Recenzent" i „Product Owner" to najczęstsze pola tego narzędzia, a filtr
    /// „wszystko, gdzie jestem recenzentem" musi być joinem w SQL
    /// (<c>docs/backend/task-management.md</c> §6).</summary>
    User = 3,

    /// <summary>Wybór z listy wartości. Trzyma się w slocie tekstowym — z punktu widzenia
    /// sortowania i filtrowania to tekst, a lista dopuszczalnych wartości jest walidacją,
    /// nie osobnym typem kolumny.</summary>
    Select = 4,
}
