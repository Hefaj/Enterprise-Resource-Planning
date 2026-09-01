namespace Notification.Application.UserNotifications;

/// <summary>
/// Oznaczanie przeczytania feedu. Implementacja w <c>Notification.Infrastructure</c>.
///
/// <para>Świadomie POZA pipeline'em <c>ICommand</c>/<c>CommandHandler</c> — to nie jest mutacja
/// agregatu biznesowego z regułą do naruszenia, tylko bezpośrednia zmiana stanu odczytu
/// własnego feedu. Idempotencja przez <c>X-Request-Id</c> nie ma tu żadnej roli (ponowne
/// „oznacz jako przeczytane" tego samego wiersza jest z definicji bezpieczne), więc narzut
/// pełnego pipeline'u komend nie ma uzasadnienia.</para>
/// </summary>
public interface IUserNotificationCommands
{
    Task SetReadAsync(Guid uuid, string ownerUserId, CancellationToken cancellationToken);

    Task SetAllReadAsync(string ownerUserId, CancellationToken cancellationToken);
}
