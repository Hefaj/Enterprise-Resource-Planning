using Erp.BuildingBlocks.Domain;

namespace Erp.BuildingBlocks.Application.Commands;

/// <summary>Jedno naruszenie reguły wejścia — pole, kod i komunikat dla developera.</summary>
/// <param name="PropertyName">Nazwa właściwości komendy, np. <c>Price</c>.</param>
/// <param name="ErrorCode">Stabilny kod (<c>snake_case</c>), po którym frontend dobiera
/// tłumaczenie — patrz <c>shared.errors.codes</c>.</param>
/// <param name="ErrorMessage">Opis dla developera; użytkownik widzi tłumaczenie kodu.</param>
public sealed record CommandValidationFailure(string PropertyName, string ErrorCode, string ErrorMessage);

/// <summary>
/// Komenda nie przeszła walidacji wejścia (FluentValidation) — odrzucona ZANIM dotknęła agregatu.
///
/// <para><b>Dziedziczy po <see cref="DomainException"/> i to jest decyzja, nie skrót.</b>
/// Ta sama komenda jedzie dwiema drogami: żądaniem HTTP i jako element zadania masowego.
/// Na HTTP odrzucenie ma być <c>400</c> z listą pól — stąd osobny typ. W zadaniu masowym musi
/// się zachować jak każde inne naruszenie reguły: element dostaje kod błędu i status, a chunk
/// idzie dalej. <c>BulkCommandRunner</c> rozpoznaje do tego wyłącznie <see cref="DomainException"/>,
/// więc wyjątek walidacji spoza tej gałęzi wywracałby całą transakcję chunka — i to nie dla
/// awarii, tylko dla jednego źle wypełnionego pola.</para>
///
/// <para>Walidacja wejścia NIE zastępuje reguł w agregacie. Sprawdza kształt komendy (zakresy,
/// wymagalność, długości), a nie stan modelu — reguła zależna od danych z bazy zostaje tam,
/// gdzie była, bo tylko tam da się ją wymusić bez wyścigu.</para>
/// </summary>
public sealed class CommandValidationException : DomainException
{
    /// <summary>Kod używany, gdy reguła nie podała własnego przez <c>WithErrorCode</c>.</summary>
    public const string DefaultErrorCode = "command_invalid";

    private static readonly IReadOnlyList<CommandValidationFailure> None = [];

    public CommandValidationException(string commandName, IReadOnlyList<CommandValidationFailure> failures)
        : base(DefaultErrorCode, BuildMessage(commandName, failures))
    {
        CommandName = commandName;
        Failures = failures;
    }

    /// <summary>Nazwa typu odrzuconej komendy.</summary>
    public string CommandName { get; } = string.Empty;

    /// <summary>Wszystkie naruszenia naraz — użytkownik ma zobaczyć komplet, a nie pierwsze z brzegu.</summary>
    public IReadOnlyList<CommandValidationFailure> Failures { get; } = None;

    /// <inheritdoc cref="CommandValidationException(string, IReadOnlyList{CommandValidationFailure})"/>
    public CommandValidationException() : base(DefaultErrorCode, "Komenda nie przeszła walidacji.")
    {
    }

    /// <inheritdoc cref="CommandValidationException(string, IReadOnlyList{CommandValidationFailure})"/>
    public CommandValidationException(string message) : base(DefaultErrorCode, message)
    {
    }

    /// <inheritdoc cref="CommandValidationException(string, IReadOnlyList{CommandValidationFailure})"/>
    public CommandValidationException(string message, Exception innerException)
        : base(DefaultErrorCode, message, innerException)
    {
    }

    private static string BuildMessage(string commandName, IReadOnlyList<CommandValidationFailure> failures)
    {
        ArgumentNullException.ThrowIfNull(failures);

        return $"Komenda {commandName} nie przeszła walidacji: "
               + string.Join("; ", failures.Select(f => $"{f.PropertyName}: {f.ErrorMessage}"));
    }
}
