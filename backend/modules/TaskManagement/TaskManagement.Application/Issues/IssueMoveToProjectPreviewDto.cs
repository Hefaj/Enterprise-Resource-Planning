namespace TaskManagement.Application.Issues;

/// <summary>Żądanie ekranu decyzji przed przeniesieniem zgłoszeń do innego projektu
/// (ISS-010 AC4) — jedno wywołanie dla całego zaznaczenia, nie per zgłoszenie.</summary>
public sealed class IssueMoveToProjectPreviewRequest
{
    public List<Guid> IssueUuids { get; set; } = [];

    public Guid TargetProjectUuid { get; set; }
}

/// <summary>Pole docelowego schematu, na które można przenieść wartość pola bez
/// bezpośredniego odpowiednika.</summary>
public sealed record IssueMoveToProjectFieldOptionDto(string Code, string Name);

/// <summary>
/// Podgląd skutków przeniesienia — front pokazuje to PRZED wysłaniem komendy, żeby użytkownik
/// zdecydował o polach bez odpowiednika, zamiast dowiedzieć się o ich utracie po fakcie
/// (ISS-010 AC4: "pokazywane do decyzji, nie kasowane po cichu").
/// </summary>
public sealed record IssueMoveToProjectPreviewDto(
    /// <summary>Kody pól niestandardowych użyte na choć jednym z zaznaczonych zgłoszeń,
    /// których nie ma w schemacie pól projektu docelowego.</summary>
    List<string> UnmatchedFieldCodes,
    /// <summary>Pola dostępne w projekcie docelowym — źródło opcji przy mapowaniu pola
    /// bez odpowiednika na inny kod (<c>IssueSetProjectCommand.FieldDecisions</c>).</summary>
    List<IssueMoveToProjectFieldOptionDto> TargetFieldOptions);

/// <summary>Odczyt podglądu przeniesienia. Implementacja w <c>TaskManagement.Infrastructure</c>,
/// bo łączy dwa istniejące odczyty (<see cref="IIssueQueries"/>, <c>IFieldSchemeQueries</c>) bez
/// własnego dostępu do bazy.</summary>
public interface IIssueMoveToProjectPreviewQueries
{
    Task<IssueMoveToProjectPreviewDto> PreviewAsync(
        IssueMoveToProjectPreviewRequest request,
        CancellationToken cancellationToken);
}
