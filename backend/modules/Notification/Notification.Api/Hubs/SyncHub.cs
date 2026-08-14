using Erp.BuildingBlocks.Contracts;
using Microsoft.AspNetCore.SignalR;

namespace Notification.Api.Hubs;

/// <summary>
/// Centralny hub synchronizacji czasu rzeczywistego — jedyne miejsce w całym backendzie,
/// gdzie żyje SignalR. Pozostałe serwisy (Catalog i kolejne) nie wiedzą o jego istnieniu;
/// publikują wyłącznie <see cref="AggregateChanged"/> do brokera, a Notification konsumuje
/// je i rozgłasza tutaj (patrz <c>Realtime/AggregateChangedRelayHandler</c>).
///
/// Ścieżka <c>/hubs/sync</c> i metoda <c>ReceiveUpdates(signature, uuids)</c> są zgodne
/// z istniejącym stubem frontendowym (<c>SignalrSyncService</c>, token <c>SIGNALR_HUB_URL</c>)
/// — podłączenie prawdziwego klienta <c>@microsoft/signalr</c> nie wymaga zmiany URL-a
/// ani kontraktu wołania.
///
/// <para><b>Grupy:</b></para>
/// <list type="bullet">
///   <item><c>agg:{signature}</c> — subskrybowana jawnie przez klienta metodą
///     <see cref="Subscribe"/>, tylko dla agregatów faktycznie trzymanych w cache
///     (<c>IdentityMapStore</c>). Bez tego każda przeglądarka dostawałaby ruch całego ERP.</item>
///   <item><c>user:{userId}</c> / <c>client:{clientId}</c> — dołączane automatycznie przy
///     połączeniu, używane do adresowania powiadomień o zadaniach wyłącznie do zleceniodawcy.</item>
/// </list>
///
/// <para><b>Znany dług techniczny — brak realnej autoryzacji.</b> Backend nie ma dziś warstwy
/// uwierzytelniania (endpointy HTTP są <c>AllowAnonymous</c>), więc <c>userId</c>/<c>clientId</c>
/// są na razie czytane wprost z query stringu połączenia, bez weryfikacji tożsamości. To
/// świadomy placeholder pod przyszłe uwierzytelnianie (JWT) — do podmiany, gdy powstanie,
/// na odczyt z <c>Context.User</c>. Dopóki go nie ma, każdy klient może podać dowolny
/// <c>userId</c> i podsłuchać cudze powiadomienia o zadaniach — akceptowalne w fazie rozwoju,
/// nie do wystawienia na produkcję bez uwierzytelniania.</para>
/// </summary>
public sealed class SyncHub : Hub
{
    /// <summary>Ścieżka, pod którą hub jest mapowany — patrz <c>Program.cs</c>.</summary>
    public const string Path = "/hubs/sync";

    public override async Task OnConnectedAsync()
    {
        var httpContext = Context.GetHttpContext();
        var userId = httpContext?.Request.Query["userId"].ToString();
        var clientId = httpContext?.Request.Query["clientId"].ToString();

        if (!string.IsNullOrWhiteSpace(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, GroupNames.ForUser(userId), Context.ConnectionAborted)
                .ConfigureAwait(false);
        }

        if (!string.IsNullOrWhiteSpace(clientId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, GroupNames.ForClient(clientId), Context.ConnectionAborted)
                .ConfigureAwait(false);
        }

        await base.OnConnectedAsync().ConfigureAwait(false);
    }

    /// <summary>
    /// Klient deklaruje zainteresowanie aktualizacjami danej sygnatury — wywoływane po
    /// załadowaniu pierwszego agregatu tego typu do <c>IdentityMapStore</c>.
    /// </summary>
    /// <param name="signature">Jedna z wartości <see cref="AggregateSignatures"/>. Sygnatury spoza
    /// znanego zbioru są po cichu ignorowane — klient nie może dołączyć do dowolnej grupy.</param>
    public async Task Subscribe(string signature)
    {
        if (!AggregateSignatures.All.Contains(signature))
        {
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupNames.ForAggregate(signature), Context.ConnectionAborted)
            .ConfigureAwait(false);
    }

    /// <summary>Odwrotność <see cref="Subscribe"/> — wywoływane, gdy orkiestrator jest niszczony
    /// albo cache danego typu zostaje wyczyszczony.</summary>
    public async Task Unsubscribe(string signature)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupNames.ForAggregate(signature), Context.ConnectionAborted)
            .ConfigureAwait(false);
    }
}

/// <summary>Nazwy grup SignalR — jedno miejsce, żeby przekaźnik zdarzeń i hub nie mogły
/// się rozjechać co do formatu nazwy.</summary>
public static class GroupNames
{
    public static string ForAggregate(string signature) => $"agg:{signature}";

    public static string ForUser(string userId) => $"user:{userId}";

    public static string ForClient(string clientId) => $"client:{clientId}";
}
