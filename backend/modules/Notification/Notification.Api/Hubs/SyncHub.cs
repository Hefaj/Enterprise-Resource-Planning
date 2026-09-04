using Erp.BuildingBlocks.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Notification.Api.Realtime;
using Notification.Infrastructure.Realtime;

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
/// <para><b>Autoryzacja.</b> Hub wymaga zalogowania (<see cref="AuthorizeAttribute"/>) — klient
/// łączy się przez <c>accessTokenFactory</c> (patrz <c>ErpAuthExtensions.OnMessageReceived</c>,
/// który czyta token z query stringu <c>access_token</c>, bo SignalR/WebSocket nie pozwala na
/// customowe nagłówki przy negocjacji). Grupa <c>user:{userId}</c> jest wyprowadzana z
/// <see cref="Hub.Context"/>.<see cref="HubCallerContext.UserIdentifier"/>, którego wartość
/// ustawia <c>SubjectUserIdProvider</c> (patrz <c>Program.cs</c>) z claimu <c>sub</c> tokenu —
/// nie z query stringu. Do 2026-08 <c>userId</c> był czytany wprost z query stringu połączenia
/// bez żadnej weryfikacji tożsamości; ta luka zniknęła razem z Keycloakiem (patrz
/// <c>docs/architecture/security.md</c> §5). <c>clientId</c> zostaje w query — to nie jest
/// tożsamość, tylko identyfikator karty przeglądarki (patrz <c>ExecutionContextMiddleware</c>).</para>
/// </summary>
[Authorize]
public sealed class SyncHub : Hub
{
    /// <summary>Ścieżka, pod którą hub jest mapowany — patrz <c>Program.cs</c>.</summary>
    public const string Path = "/hubs/sync";

    private readonly ISignatureSequenceStore _sequences;

    public SyncHub(ISignatureSequenceStore sequences)
    {
        _sequences = sequences;
    }

    public override async Task OnConnectedAsync()
    {
        var httpContext = Context.GetHttpContext();
        var userId = Context.UserIdentifier;
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
    /// załadowaniu pierwszego agregatu tego typu do <c>IdentityMapStore</c>, a także przy
    /// każdym ponownym połączeniu (<c>onreconnected</c> po stronie klienta).
    ///
    /// <para><b>Resync po luce.</b> <paramref name="lastSeenSequence"/> to ostatni numer
    /// sekwencji tej sygnatury, jaki klient widział (patrz <see cref="SignatureSequence"/>
    /// i <c>RealtimeBroadcaster.FlushAsync</c>). Jeśli różni się od aktualnego — klient
    /// przegapił zdarzenia w trakcie rozłączenia. Nie ma tu bufora historii do odtworzenia
    /// luki, więc jedyna uczciwa odpowiedź to <c>ReceiveResync</c>: każda wykryta luka
    /// kończy się pełnym przeładowaniem, nie próbą częściowego dogonienia.</para>
    /// </summary>
    /// <param name="signature">Jedna z wartości <see cref="AggregateSignatures"/>. Sygnatury spoza
    /// znanego zbioru są po cichu ignorowane — klient nie może dołączyć do dowolnej grupy.</param>
    /// <param name="lastSeenSequence">Opcjonalny — brak (pierwsza subskrypcja w tej sesji)
    /// oznacza brak punktu odniesienia, więc luka nigdy nie jest sprawdzana.</param>
    public async Task Subscribe(string signature, long? lastSeenSequence = null)
    {
        if (!AggregateSignatures.All.Contains(signature))
        {
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupNames.ForAggregate(signature), Context.ConnectionAborted)
            .ConfigureAwait(false);

        var current = await _sequences.CurrentAsync(signature, Context.ConnectionAborted).ConfigureAwait(false);

        if (lastSeenSequence.HasValue && lastSeenSequence.Value != current)
        {
            await Clients.Caller.SendAsync("ReceiveResync", signature).ConfigureAwait(false);
        }

        // Zawsze na końcu, żeby klient miał świeży punkt odniesienia — niezależnie od tego,
        // czy resync był potrzebny, czy to pierwsza subskrypcja bez wcześniejszego stanu.
        await Clients.Caller.SendAsync("ReceiveSequence", signature, current).ConfigureAwait(false);
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
