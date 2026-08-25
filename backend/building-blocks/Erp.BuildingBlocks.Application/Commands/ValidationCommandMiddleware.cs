using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace Erp.BuildingBlocks.Application.Commands;

/// <summary>
/// Uruchamia walidatory FluentValidation zarejestrowane dla typu komendy.
///
/// <para><b>Komenda bez walidatora przechodzi bez kosztu</b> — to jest warunek, żeby ten
/// mechanizm dało się wprowadzić do systemu, w którym walidacja żyła dotąd wyłącznie
/// w agregacie. Walidator jest opcjonalnym dokładaniem sprawdzeń tam, gdzie mają sens,
/// a nie nowym obowiązkiem przy każdej komendzie.</para>
///
/// <para><b>Zbiera naruszenia ze WSZYSTKICH walidatorów</b>, zamiast przerywać na pierwszym.
/// Formularz, który przy każdym zapisie pokazuje jeden kolejny błąd, zmusza użytkownika do tylu
/// prób, ile ma pól — a komplet i tak jest znany po jednym przebiegu.</para>
///
/// <para>Walidatory rozwiązywane są z <see cref="IServiceProvider"/>, a nie wstrzykiwane jako
/// <c>IEnumerable&lt;IValidator&lt;TCommand&gt;&gt;</c>: middleware jest jedną instancją dla
/// wszystkich typów komend (generyczna jest metoda, nie klasa), więc typ komendy jest znany
/// dopiero w wywołaniu.</para>
/// </summary>
public sealed class ValidationCommandMiddleware : ICommandMiddleware
{
    private readonly IServiceProvider _services;

    public ValidationCommandMiddleware(IServiceProvider services) => _services = services;

    /// <inheritdoc />
    public async Task<TResult> InvokeAsync<TCommand, TResult>(
        CommandInvocation<TCommand> invocation,
        CommandPipelineStep<TResult> continuation,
        CancellationToken cancellationToken)
        where TCommand : class
    {
        ArgumentNullException.ThrowIfNull(invocation);
        ArgumentNullException.ThrowIfNull(continuation);

        var validators = _services.GetServices<IValidator<TCommand>>().ToList();

        if (validators.Count > 0)
        {
            var failures = new List<CommandValidationFailure>();

            foreach (var validator in validators)
            {
                var result = await validator.ValidateAsync(invocation.Command, cancellationToken).ConfigureAwait(false);

                failures.AddRange(result.Errors.Select(error => new CommandValidationFailure(
                    error.PropertyName,
                    // Kod z `WithErrorCode(...)` jest kontraktem z frontendem; domyślne kody
                    // FluentValidation ("NotEmptyValidator") nim nie są i celowo do niego
                    // nie trafiają — front dostaje jeden znany kod zamiast nazwy klasy walidatora.
                    IsDomainErrorCode(error.ErrorCode) ? error.ErrorCode : CommandValidationException.DefaultErrorCode,
                    error.ErrorMessage)));
            }

            if (failures.Count > 0)
            {
                throw new CommandValidationException(invocation.CommandName, failures);
            }
        }

        return await continuation(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// Czy kod wygląda na nasz (<c>snake_case</c>), czy na domyślną nazwę walidatora
    /// FluentValidation (<c>PascalCase</c> zakończone <c>Validator</c>).
    /// </summary>
    private static bool IsDomainErrorCode(string? errorCode)
        => !string.IsNullOrWhiteSpace(errorCode)
           && !errorCode.EndsWith("Validator", StringComparison.Ordinal)
           && errorCode.All(c => char.IsLower(c) || char.IsDigit(c) || c == '_');
}
