using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using Erp.BuildingBlocks.Application.Messaging;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Primitives;

namespace Erp.BuildingBlocks.Api.Auth;

/// <summary>
/// Adres mikroserwisu Identity, z którego pozostałe serwisy pobierają efektywne uprawnienia
/// użytkownika — patrz <see cref="IPermissionProvider"/> i
/// <c>docs/architecture/security.md</c> §4.
/// </summary>
public sealed class IdentityServiceOptions
{
    public const string SectionName = "Identity";

    public string BaseUrl { get; init; } = string.Empty;
}

/// <summary>
/// Efektywny zbiór kodów uprawnień danego użytkownika — pojedyncze źródło prawdy, z którego
/// korzysta <see cref="PermissionClaimsTransformation"/> przy każdym żądaniu.
/// </summary>
public interface IPermissionProvider
{
    /// <param name="userId">Claim <c>sub</c> użytkownika, o którego uprawnienia pytamy.</param>
    /// <param name="bearerToken">Token JWT PRZEKAZUJĄCEGO żądania (nie <paramref name="userId"/>!)
    /// — Identity dziś wymaga wyłącznie ważnego tokenu na <c>/internal/users/{id}/permissions</c>
    /// (świadomie odłożona luka, patrz <c>docs/architecture/security.md</c> §7 Faza 2), więc
    /// przekazujemy dalej token WŁASNEGO żądania serwisu, nie token użytkownika docelowego —
    /// te dwa są tym samym w typowym przypadku (użytkownik pyta o swoje uprawnienia), ale nie
    /// muszą być, gdy dojdzie właściwa autoryzacja service-to-service.</param>
    /// <param name="cancellationToken">Token anulowania.</param>
    Task<IReadOnlyCollection<string>> GetPermissionsAsync(
        string userId, string? bearerToken, CancellationToken cancellationToken);

    /// <summary>
    /// Wariant przyjmujący pełny principal, nie sam <c>sub</c> — pozwala implementacjom
    /// in-process (patrz <c>Identity.Api.Auth.IdentityInProcessPermissionProvider</c>) wykonać
    /// JIT provisioning użytkownika PRZED odczytem efektywnych uprawnień, bez podwójnego
    /// wyciągania claimów w <see cref="PermissionClaimsTransformation"/>.
    ///
    /// Domyślna implementacja interfejsu deleguje do wariantu string-owego, ignorując resztę
    /// principala — wystarczające dla <see cref="HttpPermissionProvider"/>, który i tak nie ma
    /// jak nic zrobić z JIT provisioning (to zadanie samego Identity).
    /// </summary>
    Task<IReadOnlyCollection<string>> GetPermissionsAsync(
        ClaimsPrincipal principal, string? bearerToken, CancellationToken cancellationToken)
    {
        var userId = principal?.FindFirst("sub")?.Value;
        return string.IsNullOrWhiteSpace(userId)
            ? Task.FromResult<IReadOnlyCollection<string>>([])
            : GetPermissionsAsync(userId, bearerToken, cancellationToken);
    }

    /// <summary>
    /// Usuwa uprawnienia użytkownika z cache'u — wołane po wymuszonym wylogowaniu
    /// (<c>UserExecForceLogoutCommand</c>), żeby nie czekać na TTL. Implementacje, które nie
    /// cache'ują nic (np. <c>IdentityInProcessPermissionProvider</c>, zawsze czyta bazę wprost),
    /// mogą zaimplementować to jako no-op.
    /// </summary>
    Task InvalidateAsync(string userId, CancellationToken cancellationToken);
}

/// <summary>
/// Dociąga uprawnienia z <c>GET /internal/users/{id}/permissions</c> w Identity i trzyma je
/// w pamięci procesu przez <see cref="CacheTtl"/> (domyślnie 60 s).
///
/// <para><b>Dlaczego TTL, a nie <c>perm_ver</c> w tokenie JWT.</b> Docelowy projekt w
/// <c>docs/architecture/security.md</c> §4 zakładał licznik wersji niesiony w tokenie —
/// wymagałoby to jednak niestandardowego mappera Keycloaka odpytującego Identity przy KAŻDYM
/// wystawieniu tokenu (SPI po stronie Keycloaka, osobny projekt). Sam TTL=60s spełnia
/// udokumentowane SLA odwołania uprawnień (§4: „≤30-60 s") bez tej zależności — jeśli
/// zdarzenie <c>identity.user</c>/<c>identity.role</c> kiedyś zacznie unieważniać cache
/// aktywnie (zamiast czekać na wygaśnięcie), to wyłącznie optymalizacja czasu reakcji,
/// nie warunek poprawności.</para>
///
/// <para><b>Stan w pamięci procesu — i tak ma zostać.</b> Rozważany był wspólny cache w Redisie
/// (<c>IDistributedCache</c>) i został odrzucony: wkładałby Redisa na ścieżkę <i>każdego żądania
/// każdego serwisu</i>, w dodatku w warstwie autoryzacji, więc jego awaria musiałaby mieć
/// zaprojektowaną degradację — inaczej kładzie cały ERP. Zamiast tego szybka ścieżka zostaje
/// w pamięci procesu, a propagacja unieważnień idzie RabbitMQ, który i tak jest zależnością
/// każdego serwisu (patrz <see cref="PermissionsInvalidated"/>).</para>
///
/// <para><b>Gwarancją pozostaje TTL, nie komunikat.</b> Broadcast skraca czas reakcji z 60 s do
/// sekundy; jego utrata cofa zachowanie do samego TTL. Ta klasa nie może więc pogorszyć postawy
/// bezpieczeństwa względem stanu sprzed wieloinstancyjności — może ją tylko poprawić.</para>
/// </summary>
public sealed class HttpPermissionProvider : IPermissionProvider, IPermissionCacheInvalidator, IDisposable
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(60);

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _cache;
    private readonly ILogger<HttpPermissionProvider> _logger;

    /// <summary>
    /// Wspólny „bezpiecznik" wszystkich wpisów uprawnień — pozwala wyczyścić je <b>wszystkie</b>
    /// jednym ruchem.
    ///
    /// <para><see cref="IMemoryCache"/> nie umie usuwać po prefiksie, a trzymanie listy kluczy
    /// obok cache'u byłoby drugim rejestrem do zsynchronizowania. Token wygaśnięcia rozwiązuje to
    /// bez dodatkowego stanu: anulowanie źródła unieważnia każdy wpis, który się do niego
    /// podpiął. Źródło jest potem podmieniane, bo anulowanego nie da się użyć ponownie.</para>
    ///
    /// <para>Pole instancyjne wystarcza, bo dostawca jest singletonem (patrz <c>AddErpAuth</c>)
    /// i dzieli ten sam <see cref="IMemoryCache"/> z każdym żądaniem procesu.</para>
    /// </summary>
    private CancellationTokenSource _flushSignal = new();

    public HttpPermissionProvider(
        IHttpClientFactory httpClientFactory, IMemoryCache cache, ILogger<HttpPermissionProvider> logger)
    {
        _httpClientFactory = httpClientFactory;
        _cache = cache;
        _logger = logger;
    }

    public async Task<IReadOnlyCollection<string>> GetPermissionsAsync(
        string userId, string? bearerToken, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(userId);

        var cacheKey = $"perm:{userId}";

        if (_cache.TryGetValue(cacheKey, out IReadOnlyCollection<string>? cached) && cached is not null)
        {
            return cached;
        }

        try
        {
            var client = _httpClientFactory.CreateClient(IdentityHttpClientName);

            using var request = new HttpRequestMessage(HttpMethod.Get, $"/internal/users/{userId}/permissions");
            if (!string.IsNullOrWhiteSpace(bearerToken))
            {
                // Identity jest za tym samym Fallback Policy co każdy inny serwis (Faza 1) —
                // bez przekazania dalej tokenu żądania, które w ogóle wywołało tę transformację,
                // to wywołanie serwis-do-serwisu dostaje 401 zanim zdąży odpowiedzieć.
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearerToken);
            }

            using var response = await client.SendAsync(request, cancellationToken).ConfigureAwait(false);
            response.EnsureSuccessStatusCode();

            var permissions = await response.Content
                .ReadFromJsonAsync<List<string>>(cancellationToken)
                .ConfigureAwait(false) ?? [];

            var entryOptions = new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = CacheTtl };

            // Wpis wygasa albo po TTL, albo na sygnał pełnego czyszczenia — co przyjdzie pierwsze.
            entryOptions.AddExpirationToken(new CancellationChangeToken(_flushSignal.Token));

            _cache.Set(cacheKey, (IReadOnlyCollection<string>)permissions, entryOptions);
            return permissions;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            // Identity niedostępny nie może oznaczać "wszystko wolno" — patrz uzasadnienie
            // "secure by default" w Fazie 1. Pusty zbiór jest bezpieczną awarią: użytkownik
            // dostaje 403 zamiast cichego ominięcia kontroli dostępu.
            LogIdentityUnavailable(_logger, userId, ex);
            return [];
        }
    }

    /// <inheritdoc />
    public Task InvalidateAsync(string userId, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(userId);
        _cache.Remove($"perm:{userId}");
        return Task.CompletedTask;
    }

    /// <summary>
    /// Unieważnienie przyjęte z broadcastu — jednego użytkownika albo, gdy nie wiadomo którego
    /// (zmiana na poziomie roli), wszystkich.
    /// </summary>
    Task IPermissionCacheInvalidator.InvalidateAsync(string? userId, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(userId))
        {
            return InvalidateAsync(userId, cancellationToken);
        }

        // Podmiana PRZED anulowaniem: nowe wpisy podpinają się już do świeżego źródła, więc
        // nie mogą urodzić się od razu unieważnione.
        var previous = Interlocked.Exchange(ref _flushSignal, new CancellationTokenSource());

        previous.Cancel();
        previous.Dispose();

        return Task.CompletedTask;
    }

    /// <summary>
    /// Zwalnia bieżące źródło sygnału czyszczenia. Dostawca jest singletonem, więc dzieje się to
    /// przy zamykaniu hosta — porządek dla analizatora, nie mechanizm, na którym cokolwiek stoi.
    /// </summary>
    public void Dispose() => _flushSignal.Dispose();

    /// <summary>Nazwa nazwanego <see cref="HttpClient"/> rejestrowanego w <c>AddErpAuth</c>.</summary>
    public const string IdentityHttpClientName = "Identity";

    private static readonly Action<ILogger, string, Exception> LogIdentityUnavailable = LoggerMessage.Define<string>(
        LogLevel.Warning,
        new EventId(1, nameof(LogIdentityUnavailable)),
        "Nie udało się pobrać uprawnień z Identity dla użytkownika {UserId} — zwracam pusty zbiór (secure by default).");
}
