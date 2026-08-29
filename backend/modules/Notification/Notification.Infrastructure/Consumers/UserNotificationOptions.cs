namespace Notification.Infrastructure.Consumers;

/// <summary>Granice fan-outu powiadomień użytkownika. Chronią pojedynczy błędny event przed
/// zapisaniem nieograniczonej liczby wierszy w skrzynkach.</summary>
public sealed class UserNotificationOptions
{
    public const string SectionName = "UserNotifications";

    public int MaxRecipientsPerEvent { get; init; } = 500;

    public TimeSpan GroupWindow { get; init; } = TimeSpan.FromHours(4);
}
