namespace TaskManagement.Domain.Issues;

/// <summary>
/// Rodzaj wpisu w historii zgłoszenia.
///
/// <para>Rodzaj jest osobno od <c>field_code</c>, bo odpowiada na inne pytanie: rodzaj mówi,
/// <b>jak</b> czytać wpis (zmiana pola, komentarz, plik), a kod pola — <b>czego</b> dotyczy.
/// Front dobiera po rodzaju szablon zdania, po kodzie pola — nazwę pola.</para>
/// </summary>
public enum IssueActivityKind
{
    /// <summary>Założenie zgłoszenia — pierwszy wpis w każdej historii.</summary>
    Created = 0,

    /// <summary>Zmiana zwykłego pola (tytuł, priorytet, przypisany, termin, opis).</summary>
    FieldChanged = 1,

    /// <summary>Zmiana stanu. Osobno od <see cref="FieldChanged"/>, bo to jedyna zmiana
    /// przechodząca przez automat stanów i jedyna, którą czyta się jako krok procesu.</summary>
    StateChanged = 2,

    CommentAdded = 3,

    CommentRemoved = 4,

    AttachmentAdded = 5,

    /// <summary>Wpis czasu (TIME-001) — <c>field_code</c> niesie rodzaj pracy,
    /// <c>new_value</c> liczbę minut. Front kieruje ten rodzaj do filtra „Czas", nie „Historia".</summary>
    WorkLogAdded = 6,

    WorkLogRemoved = 7,

    /// <summary>Usunięcie pojedynczego załącznika (ATT-002).</summary>
    AttachmentRemoved = 8,

    /// <summary>Dopięcie linku zewnętrznego (API-005) — repozytorium, PR, CI. Nigdy integracja
    /// w domenie, wyłącznie adres URL z etykietą.</summary>
    ExternalLinkAdded = 9,

    ExternalLinkRemoved = 10,
}
