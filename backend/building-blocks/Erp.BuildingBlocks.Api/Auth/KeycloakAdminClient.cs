using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace Erp.BuildingBlocks.Api.Auth;

/// <summary>
/// Implementacja przez zwykły <see cref="HttpClient"/> (bez zewnętrznej biblioteki klienta
/// Keycloaka — Admin API jest tu wołane w jednym, wąskim miejscu, żeby uzasadniać zależność).
///
/// <para><b>Token service-account.</b> Uzyskuje token client_credentials klienta
/// <c>erp-identity-service</c> (patrz <c>backend/keycloak/realm-erp.json</c>) i trzyma go
/// w pamięci procesu do momentu bliskiego wygaśnięcia — ten sam TTL-cache co
/// <see cref="HttpPermissionProvider"/>, tylko prostszy (jeden token, nie jeden na
/// użytkownika).</para>
/// </summary>
public sealed class KeycloakAdminClient : IKeycloakAdminClient, IDisposable
{
    /// <summary>Nazwa nazwanego <see cref="HttpClient"/> rejestrowanego w <c>AddErpKeycloakAdmin</c>.</summary>
    public const string HttpClientName = "KeycloakAdmin";

    // Odświeżamy nieco przed faktycznym wygaśnięciem, żeby uniknąć wyścigu, w którym token
    // wygasa w trakcie budowania żądania.
    private static readonly TimeSpan ExpiryMargin = TimeSpan.FromSeconds(10);

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly KeycloakAdminOptions _options;
    private readonly SemaphoreSlim _tokenLock = new(1, 1);

    private string? _cachedAccessToken;
    private DateTimeOffset _cachedAccessTokenExpiresAt = DateTimeOffset.MinValue;

    public KeycloakAdminClient(IHttpClientFactory httpClientFactory, IOptions<KeycloakAdminOptions> options)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
    }

    public async Task RevokeUserSessionsAsync(string keycloakUserSub, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(keycloakUserSub);

        var accessToken = await GetAccessTokenAsync(cancellationToken).ConfigureAwait(false);

        var client = _httpClientFactory.CreateClient(HttpClientName);
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"/admin/realms/{_options.Realm}/users/{keycloakUserSub}/logout");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        using var response = await client.SendAsync(request, cancellationToken).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();
    }

    private async Task<string> GetAccessTokenAsync(CancellationToken cancellationToken)
    {
        if (_cachedAccessToken is not null && DateTimeOffset.UtcNow < _cachedAccessTokenExpiresAt)
        {
            return _cachedAccessToken;
        }

        await _tokenLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (_cachedAccessToken is not null && DateTimeOffset.UtcNow < _cachedAccessTokenExpiresAt)
            {
                return _cachedAccessToken;
            }

            var client = _httpClientFactory.CreateClient(HttpClientName);

            using var form = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials",
                ["client_id"] = _options.ClientId,
                ["client_secret"] = _options.ClientSecret,
            });

            using var response = await client
                .PostAsync($"/realms/{_options.Realm}/protocol/openid-connect/token", form, cancellationToken)
                .ConfigureAwait(false);
            response.EnsureSuccessStatusCode();

            var token = await response.Content
                .ReadFromJsonAsync<KeycloakTokenResponse>(cancellationToken)
                .ConfigureAwait(false);

            if (token is null || string.IsNullOrWhiteSpace(token.AccessToken))
            {
                throw new InvalidOperationException(
                    "Keycloak nie zwrócił tokenu dostępu dla service-account erp-identity-service.");
            }

            _cachedAccessToken = token.AccessToken;
            _cachedAccessTokenExpiresAt = DateTimeOffset.UtcNow
                + TimeSpan.FromSeconds(Math.Max(token.ExpiresIn, 0)) - ExpiryMargin;

            return _cachedAccessToken;
        }
        finally
        {
            _tokenLock.Release();
        }
    }

    public void Dispose() => _tokenLock.Dispose();

    private sealed class KeycloakTokenResponse
    {
        [JsonPropertyName("access_token")]
        public string AccessToken { get; set; } = string.Empty;

        [JsonPropertyName("expires_in")]
        public int ExpiresIn { get; set; }
    }
}
