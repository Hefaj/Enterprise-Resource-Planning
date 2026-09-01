namespace Notification.Application.UserNotifications;

/// <summary>Odczyty feedu powiadomień. Implementacja w <c>Notification.Infrastructure</c>.
///
/// <para>Jak <c>IJobQueries</c> — właściciel jest parametrem, nie filtrem z żądania. Endpoint
/// bierze <c>ownerUserId</c> z <c>IExecutionContext</c> (claim <c>sub</c>), nigdy z ciała
/// żądania, inaczej dowolny klient odczytałby cudzy feed.</para>
/// </summary>
public interface IUserNotificationQueries
{
    Task<SearchUserNotificationResponse> SearchAsync(
        SearchUserNotificationRequest request, string ownerUserId, CancellationToken cancellationToken);

    Task<int> GetUnreadCountAsync(string ownerUserId, CancellationToken cancellationToken);
}
