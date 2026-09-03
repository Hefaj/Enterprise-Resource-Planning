using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Application.Issues;

/// <summary>
/// Błąd DSL wyszukiwania (SRCH-005 AC1) — zarówno gramatyczny (nieoczekiwany token, brakujący
/// `:`), jak i semantyczny (nieznane pole, wartość, której nie da się rozwiązać). Jeden typ dla
/// obu, bo z perspektywy użytkownika to ta sama sytuacja: „tekst w tym miejscu jest niepoprawny".
///
/// <para>Dziedziczy po <see cref="DomainException"/>, żeby <c>ErpProblemDetailsHandler</c>
/// zmapował go na <c>422</c> bez żadnej zmiany w building-blocks — <see cref="Position"/> jest
/// domyślnie wplecione w <see cref="Exception.Message"/> (patrz konstruktor), więc trafia do
/// klienta w treści <c>ProblemDetails.Detail</c>.</para>
/// </summary>
public sealed class IssueSearchDslParseException : DomainException
{
    public const string Code = "taskmgmt.issue_search_dsl_invalid";

    public IssueSearchDslParseException(string message, int position)
        : base(Code, $"{message} (pozycja {position}).") => Position = position;

    /// <summary>Pozycja tokenu w oryginalnym tekście DSL, licząc od zera.</summary>
    public int Position { get; }
}
