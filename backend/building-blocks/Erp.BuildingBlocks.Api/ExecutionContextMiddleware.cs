using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.AspNetCore.Http;

namespace Erp.BuildingBlocks.Api;

/// <summary>
/// Wypełnia <see cref="IExecutionContext"/> na granicy HTTP — bez tego zadania masowe powstają
/// z pustym <c>UserId</c>/<c>ClientId</c>, a powiadomienie o ich zakończeniu leci do grupy
/// SignalR, do której nikt nie należy (patrz <c>RealtimeBroadcaster.BroadcastJobsAsync</c>).
///
/// <para><b>To nie jest uwierzytelnianie.</b> Wartości pochodzą wprost z nagłówków żądania,
/// bez żadnej weryfikacji tożsamości — dokładnie tak, jak <c>SyncHub</c> czyta je dziś z query
/// stringu połączenia. Jest to świadomy placeholder na czas, gdy backend nie ma jeszcze JWT:
/// pozwala domknąć pętlę „zleć zadanie → dostań powiadomienie” dla właściwej karty przeglądarki,
/// ale każdy klient może podać cudzy identyfikator. Gdy powstanie uwierzytelnianie, to jest
/// jedyne miejsce do podmiany — odczyt z <c>context.User</c> zamiast z nagłówków.</para>
///
/// <para><c>X-Client-Id</c> jest generowany przez przeglądarkę raz na kartę (sessionStorage)
/// i tym samym identyfikatorem klient przedstawia się hubowi, więc HTTP i SignalR wskazują
/// na tego samego adresata.</para>
/// </summary>
public sealed class ExecutionContextMiddleware
{
    /// <summary>Nagłówek z identyfikatorem karty przeglądarki.</summary>
    public const string ClientIdHeader = "X-Client-Id";

    /// <summary>Nagłówek z identyfikatorem użytkownika — do czasu wdrożenia JWT.</summary>
    public const string UserIdHeader = "X-User-Id";

    /// <summary>Nagłówek korelacji; nierozpoznawalna wartość jest ignorowana.</summary>
    public const string CorrelationIdHeader = "X-Correlation-Id";

    private readonly RequestDelegate _next;

    public ExecutionContextMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, IExecutionContext executionContext)
    {
        ArgumentNullException.ThrowIfNull(context);

        // Rejestracja jest typ→interfejs (patrz komentarz w AddErpApi), więc do settera
        // dochodzimy rzutowaniem. Gdyby ktoś kiedyś podmienił implementację na niemutowalną,
        // middleware po prostu przepuści żądanie zamiast wywalić cały pipeline.
        if (executionContext is MutableExecutionContext mutable)
        {
            var clientId = Trimmed(context.Request.Headers[ClientIdHeader].ToString());
            var userId = Trimmed(context.Request.Headers[UserIdHeader].ToString());
            var correlationId = Guid.TryParse(context.Request.Headers[CorrelationIdHeader].ToString(), out var parsed)
                ? parsed
                : (Guid?)null;

            mutable.Set(userId, clientId, correlationId);
        }

        await _next(context).ConfigureAwait(false);
    }

    private static string? Trimmed(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
