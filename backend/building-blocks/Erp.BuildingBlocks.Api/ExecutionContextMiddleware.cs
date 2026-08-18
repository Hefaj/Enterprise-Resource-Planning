using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.AspNetCore.Http;

namespace Erp.BuildingBlocks.Api;

/// <summary>
/// Wypełnia <see cref="IExecutionContext"/> na granicy HTTP — bez tego zadania masowe powstają
/// z pustym <c>UserId</c>/<c>ClientId</c>, a powiadomienie o ich zakończeniu leci do grupy
/// SignalR, do której nikt nie należy (patrz <c>RealtimeBroadcaster.BroadcastJobsAsync</c>).
///
/// <para><c>UserId</c> pochodzi z claimu <c>sub</c> zweryfikowanego tokenu JWT
/// (<c>Erp.BuildingBlocks.Api.Auth.ErpAuthExtensions</c>) — middleware biegnie PO
/// <c>UseAuthentication</c>/<c>UseAuthorization</c>, więc <c>context.User</c> jest tu już
/// ustawiony i zweryfikowany. Do 2026-08 był czytany wprost z nagłówka <c>X-User-Id</c> bez
/// żadnej weryfikacji — każdy klient mógł podać cudzy identyfikator; ten placeholder zniknął
/// razem z wdrożeniem Keycloaka (patrz <c>docs/backend/identity-authz.md</c> §5).</para>
///
/// <para><c>X-Client-Id</c> zostaje nagłówkiem — to nie jest tożsamość, tylko identyfikator
/// karty przeglądarki generowany po stronie klienta raz na kartę (sessionStorage), używany
/// wyłącznie do adresowania powiadomień o zadaniach do właściwej karty tego samego
/// użytkownika. Tym samym identyfikatorem klient przedstawia się hubowi SignalR, więc HTTP
/// i SignalR wskazują na tego samego adresata.</para>
/// </summary>
public sealed class ExecutionContextMiddleware
{
    /// <summary>Nagłówek z identyfikatorem karty przeglądarki.</summary>
    public const string ClientIdHeader = "X-Client-Id";

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
            var userId = context.User.FindFirst("sub")?.Value;
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
