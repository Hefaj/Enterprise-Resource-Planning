namespace TaskManagement.Application.Abstractions;

/// <summary>
/// Oczyszcza HTML wpisany przez użytkownika w edytorze tekstu formatowanego.
///
/// <para><b>Sanityzacja idzie przy zapisie, nie przy renderowaniu.</b> Front sanityzuje po swojej
/// stronie (Angular robi to dla `[innerHTML]`, `tui-editor-socket` idzie przez `DomSanitizer`),
/// ale zapisaną treść czytają też eksporty, powiadomienia i integracje — a każdy z tych
/// konsumentów musiałby wtedy pamiętać o tym samym. Baza ma nie zawierać wrogiego znacznika.</para>
///
/// <para><b>Dlaczego w handlerze, a nie w agregacie.</b> To normalizacja wejścia na granicy, nie
/// reguła biznesowa: <c>Issue</c> nie wie, że opis bywa HTML-em, i nie może zależeć od parsera.
/// Handler czyści treść i dopiero czystą podaje metodzie agregatu.</para>
///
/// <para><b>Dlaczego w module, a nie w building-blocks.</b> To pierwsze użycie. Wydzielenie do
/// fundamentu przy drugim (DMS) albo trzecim odbiorcy, gdy będzie wiadomo, co w tym jest wspólne,
/// a co domenowe — ta sama zasada, co przy slotach pól niestandardowych
/// (<c>docs/backend/task-management.md</c> §6).</para>
/// </summary>
public interface IRichTextSanitizer
{
    /// <summary>Zwraca treść bez znaczników spoza białej listy. <c>null</c> i pusty wynik
    /// (np. sam `&lt;p&gt;&lt;/p&gt;` po oczyszczeniu) zwracają <c>null</c> — „opis pusty"
    /// ma mieć w bazie jedną reprezentację, nie dwie.</summary>
    string? Sanitize(string? html);
}
