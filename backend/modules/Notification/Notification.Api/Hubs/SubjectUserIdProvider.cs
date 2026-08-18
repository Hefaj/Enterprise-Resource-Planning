using Microsoft.AspNetCore.SignalR;

namespace Notification.Api.Hubs;

/// <summary>
/// Domyślny <see cref="IUserIdProvider"/> ASP.NET Core wyprowadza <c>Context.UserIdentifier</c>
/// z <c>ClaimTypes.NameIdentifier</c> — a token Keycloaka niesie tożsamość w claimie <c>sub</c>
/// pod jego oryginalną nazwą, bo <c>ErpAuthExtensions</c> celowo wyłącza mapowanie inbound
/// claimów (<c>MapInboundClaims = false</c>), żeby uniknąć rozjazdu nazw claimów między
/// serwisami. Bez tego providera <c>SyncHub.Context.UserIdentifier</c> byłoby zawsze <c>null</c>
/// i grupa <c>user:{userId}</c> nigdy by się nie wypełniła.
/// </summary>
public sealed class SubjectUserIdProvider : IUserIdProvider
{
    public string? GetUserId(HubConnectionContext connection)
        => connection.User.FindFirst("sub")?.Value;
}
