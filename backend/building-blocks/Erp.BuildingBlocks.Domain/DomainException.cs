namespace Erp.BuildingBlocks.Domain;

/// <summary>
/// Naruszenie reguły biznesowej — rzucane przez metody agregatu, nigdy przez infrastrukturę.
///
/// <see cref="ErrorCode"/> jest tu kluczowy i nie jest ozdobnikiem: ląduje w kolumnie
/// <c>job_item.error_code</c> przy operacjach masowych i w <c>ProblemDetails.type</c> na HTTP.
/// Dzięki temu raport z bulku na 50 tys. produktów da się pogrupować po przyczynie
/// („1200 × price_negative”) zamiast wyświetlać 1200 wolnych tekstów. Frontend może też
/// zmapować kod na klucz tłumaczenia Transloco — komunikat z tej klasy jest dla developera,
/// nie dla użytkownika końcowego.
///
/// Kody piszemy <c>snake_case</c>, w formie rzeczownikowej opisującej naruszenie
/// (<c>price_negative</c>, <c>name_empty</c>, <c>category_cycle</c>).
/// </summary>
public class DomainException : Exception
{
    /// <summary>Stabilny, maszynowo przetwarzalny identyfikator naruszonej reguły.</summary>
    public string ErrorCode { get; }

    public DomainException(string errorCode, string message) : base(message)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(errorCode);
        ErrorCode = errorCode;
    }

    public DomainException(string errorCode, string message, Exception innerException)
        : base(message, innerException)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(errorCode);
        ErrorCode = errorCode;
    }

    /// <summary>Wymagane przez wytyczne projektowania wyjątków; w kodzie domenowym
    /// używaj przeciążeń z <c>errorCode</c>.</summary>
    public DomainException() : this("domain_error", "Naruszenie reguły domenowej.")
    {
    }

    /// <inheritdoc cref="DomainException()"/>
    public DomainException(string message) : this("domain_error", message)
    {
    }

    /// <inheritdoc cref="DomainException()"/>
    public DomainException(string message, Exception innerException)
        : this("domain_error", message, innerException)
    {
    }
}

/// <summary>
/// Nie znaleziono agregatu o podanym identyfikatorze. Wydzielone z <see cref="DomainException"/>,
/// bo ma inne mapowanie na HTTP (404, nie 422) i przy operacjach masowych oznacza zwykle
/// wyścig — element zniknął między zbudowaniem listy celów a wykonaniem komendy — a nie błąd
/// wejścia użytkownika.
/// </summary>
public sealed class AggregateNotFoundException : DomainException
{
    public AggregateNotFoundException(string aggregateName, Guid uuid)
        : base("aggregate_not_found", $"Nie znaleziono agregatu {aggregateName} o identyfikatorze {uuid}.")
    {
        AggregateName = aggregateName;
        Uuid = uuid;
    }

    public string AggregateName { get; } = string.Empty;

    public Guid Uuid { get; }

    public AggregateNotFoundException() : base("aggregate_not_found", "Nie znaleziono agregatu.")
    {
    }

    public AggregateNotFoundException(string message) : base("aggregate_not_found", message)
    {
    }

    public AggregateNotFoundException(string message, Exception innerException)
        : base("aggregate_not_found", message, innerException)
    {
    }
}
