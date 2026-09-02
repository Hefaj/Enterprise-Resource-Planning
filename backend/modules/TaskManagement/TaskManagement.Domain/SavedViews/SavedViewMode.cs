namespace TaskManagement.Domain.SavedViews;

/// <summary>
/// Tryb prezentacji listy zgłoszeń zapamiętany razem z widokiem (LNK-006, faza 4) — lista płaska
/// albo drzewo. Sam przełącznik trybu na liście jest osobną funkcją (LNK-006); tu tylko
/// przechowujemy, w jakim trybie użytkownik zapisał widok.
/// </summary>
public enum SavedViewMode
{
    List = 0,
    Tree = 1,
}
