using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Application.Commands;
using Erp.BuildingBlocks.Domain;
using Erp.BuildingBlocks.Persistence;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Erp.BuildingBlocks.Api;

/// <summary>
/// Zamienia wyjątek na odpowiedź <c>ProblemDetails</c> ze stabilnym kodem błędu.
///
/// <para><b>Po co, skoro błędy i tak wracały.</b> Wracały jako <c>500</c> z tekstem wyjątku
/// (albo, w środowisku produkcyjnym, jako <c>500</c> z niczym). Naruszenie reguły biznesowej
/// wyglądało więc dla klienta identycznie jak awaria bazy: nie dało się na nim oprzeć ani
/// komunikatu, ani decyzji „czy warto ponowić". Kod z <see cref="DomainException.ErrorCode"/>
/// jest tą samą wartością, którą operacje masowe zapisują w <c>job_item.error_code</c>, więc
/// frontend ma JEDEN słownik tłumaczeń dla obu dróg (<c>shared.errors.codes</c>) — a nie dwa,
/// z których drugi trzeba by wymyślić.</para>
///
/// <para><b>Rozdział 4xx od 5xx jest tu decyzją produktową, nie kosmetyką.</b> To po nim klient
/// (i człowiek czytający log) rozpoznaje, czy powtórzenie żądania ma jakikolwiek sens:
/// <c>422</c> powtórzone da ten sam wynik, <c>409</c> warto ponowić, <c>500</c> należy zgłosić.</para>
///
/// <list type="table">
///   <item><term>400</term><description>Walidacja wejścia — komplet naruszeń w <c>errors</c>.</description></item>
///   <item><term>404</term><description>Agregat nie istnieje.</description></item>
///   <item><term>409</term><description>Konflikt współbieżności albo równoległa powtórka tego samego żądania.</description></item>
///   <item><term>422</term><description>Naruszenie reguły biznesowej — żądanie zrozumiałe, ale niewykonalne.</description></item>
///   <item><term>500</term><description>Reszta; komunikat NIE wychodzi na zewnątrz, ląduje w logu.</description></item>
/// </list>
/// </summary>
public sealed partial class ErpProblemDetailsHandler : IExceptionHandler
{
    /// <summary>Kod dla żądania, którego bliźniak wykonuje się właśnie równolegle.</summary>
    public const string DuplicateRequestErrorCode = "request_duplicate";

    /// <summary>Nazwa ograniczenia klucza głównego rejestru idempotencji w Postgresie.</summary>
    private const string IdempotencyPrimaryKey = "pk_idempotency_key";

    private const string UniqueViolation = "23505";

    private readonly ILogger<ErpProblemDetailsHandler> _logger;
    private readonly IHostEnvironment _environment;

    /// <param name="logger">Log.</param>
    /// <param name="environment">Środowisko hosta — poza Development treść wyjątku nie wychodzi
    /// z serwisu.</param>
    /// <remarks>
    /// Handler jest SINGLETONEM (tak rejestruje go <c>AddExceptionHandler</c>), więc kontekst
    /// wykonania i tłumacz awarii zapisu — obie usługi scoped — brane są ze scope'u żądania
    /// (<c>HttpContext.RequestServices</c>), a nie wstrzykiwane. Wstrzyknięcie zamroziłoby
    /// pierwszy scope na cały czas życia procesu i każdy błąd raportowałby korelację
    /// pierwszego żądania po starcie.
    /// </remarks>
    public ErpProblemDetailsHandler(ILogger<ErpProblemDetailsHandler> logger, IHostEnvironment environment)
    {
        _logger = logger;
        _environment = environment;
    }

    /// <inheritdoc />
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(httpContext);

        var services = httpContext.RequestServices;
        var correlationId = services.GetService<IExecutionContext>()?.CorrelationId ?? Guid.Empty;
        var translator = services.GetService<IPersistenceExceptionTranslator>();

        var problem = Map(exception, translator);

        // Korelacja w treści odpowiedzi, a nie tylko w logu: bez niej zgłoszenie użytkownika
        // („wyskoczył błąd") nie ma jak trafić do konkretnego wpisu w logach serwisu.
        problem.Extensions["correlationId"] = correlationId;

        if (problem.Status >= StatusCodes.Status500InternalServerError)
        {
            LogUnhandled(_logger, httpContext.Request.Path, correlationId, exception);

            // W Development treść wyjątku wraca do klienta, bo inaczej ten handler zabierałby
            // programiście stronę diagnostyczną ASP.NET (jest od niej bardziej wewnętrzny,
            // więc wygrywa) i nie dawał nic w zamian. Poza Development — nigdy.
            if (_environment.IsDevelopment())
            {
                problem.Extensions["exception"] = exception?.ToString();
            }
        }

        httpContext.Response.StatusCode = problem.Status ?? StatusCodes.Status500InternalServerError;
        await httpContext.Response.WriteAsJsonAsync(problem, cancellationToken).ConfigureAwait(false);

        return true;
    }

    private static ProblemDetails Map(Exception exception, IPersistenceExceptionTranslator? translator) => exception switch
    {
        // Kolejność ma znaczenie: wyjątek walidacji dziedziczy po DomainException (żeby operacja
        // masowa mogła go potraktować jak każde inne odrzucenie elementu), więc musi być
        // rozpoznany PIERWSZY, inaczej dostałby 422 zamiast 400 i zgubił listę pól.
        CommandValidationException validation => Validation(validation),
        AggregateNotFoundException notFound => Problem(
            StatusCodes.Status404NotFound, notFound.ErrorCode, "Nie znaleziono zasobu.", notFound.Message),
        DomainException domain => Problem(
            StatusCodes.Status422UnprocessableEntity, domain.ErrorCode, "Naruszenie reguły biznesowej.", domain.Message),
        DbUpdateConcurrencyException => Problem(
            StatusCodes.Status409Conflict,
            "concurrency_conflict",
            "Konflikt współbieżności.",
            "Zasób zmienił się w trakcie operacji — pobierz aktualny stan i spróbuj ponownie."),
        DbUpdateException update => Persistence(update, translator),
        _ => Problem(
            StatusCodes.Status500InternalServerError,
            "internal_error",
            "Błąd serwera.",
            // Świadomie bez treści wyjątku: komunikaty potrafią nieść nazwy tabel, fragmenty
            // zapytań i wartości danych. Diagnostyka jest w logu, po korelacji z odpowiedzi.
            "Operacja nie powiodła się. Zgłoś problem, podając identyfikator korelacji."),
    };

    private static ProblemDetails Persistence(DbUpdateException exception, IPersistenceExceptionTranslator? translator)
    {
        // Powtórka żądania, które właśnie wykonuje się równolegle: pierwszy zapisał klucz
        // idempotencji, drugi rozbił się o jego unikalność. To jedyny przypadek, w którym
        // ponowienie za chwilę ma sens — i wtedy zwróci zapamiętany wynik.
        if (IsUniqueViolation(exception, IdempotencyPrimaryKey))
        {
            return Problem(
                StatusCodes.Status409Conflict,
                DuplicateRequestErrorCode,
                "Powtórzone żądanie.",
                "Żądanie o tym identyfikatorze jest właśnie wykonywane.");
        }

        // Reguła oparta na unikalności jest regułą biznesową przebraną za awarię zapisu —
        // ten sam kod, co przy odrzuceniu przez pre-check wsadowy (patrz PostgresExceptionTranslator).
        if (translator is not null && translator.TryTranslate(exception, out var domain))
        {
            return Problem(
                StatusCodes.Status422UnprocessableEntity, domain.ErrorCode, "Naruszenie reguły biznesowej.", domain.Message);
        }

        return Problem(
            StatusCodes.Status500InternalServerError,
            "persistence_error",
            "Błąd zapisu.",
            "Nie udało się zapisać zmian. Zgłoś problem, podając identyfikator korelacji.");
    }

    private static bool IsUniqueViolation(DbUpdateException exception, string constraintName)
        => exception.InnerException is PostgresException postgres
           && string.Equals(postgres.SqlState, UniqueViolation, StringComparison.Ordinal)
           && string.Equals(postgres.ConstraintName, constraintName, StringComparison.Ordinal);

    private static ProblemDetails Validation(CommandValidationException exception)
    {
        var problem = Problem(
            StatusCodes.Status400BadRequest,
            exception.ErrorCode,
            "Nieprawidłowe żądanie.",
            $"Komenda {exception.CommandName} nie przeszła walidacji.");

        // Kształt `errors` zgodny z ValidationProblemDetails ASP.NET — front ma jeden sposób
        // czytania błędów pola niezależnie od tego, czy odrzuciła je walidacja FastEndpoints,
        // czy pipeline komend.
        problem.Extensions["errors"] = exception.Failures
            .GroupBy(f => f.PropertyName, StringComparer.Ordinal)
            .ToDictionary(
                group => group.Key,
                group => group.Select(f => new { f.ErrorCode, f.ErrorMessage }).ToArray(),
                StringComparer.Ordinal);

        return problem;
    }

    private static ProblemDetails Problem(int status, string errorCode, string title, string detail)
    {
        var problem = new ProblemDetails
        {
            Status = status,
            Title = title,
            Detail = detail,
            // `type` niesie kod błędu — tak, jak zapowiada dokumentacja DomainException.
            Type = errorCode,
        };

        // Ta sama wartość jeszcze raz, pod jednoznaczną nazwą: `type` w ProblemDetails jest
        // z definicji URI i klienty (oraz generatory) potrafią go tak traktować. Frontend czyta
        // `errorCode` i nie musi zgadywać, czy dostał kod, czy adres dokumentacji.
        problem.Extensions["errorCode"] = errorCode;

        return problem;
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Error,
        Message = "Nieobsłużony wyjątek przy {Path} [{CorrelationId}].")]
    private static partial void LogUnhandled(ILogger logger, string path, Guid correlationId, Exception exception);
}
