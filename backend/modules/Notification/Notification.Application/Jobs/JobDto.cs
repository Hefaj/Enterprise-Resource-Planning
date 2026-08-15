namespace Notification.Application.Jobs;

// Kształt jest ZAMROŻONY: generuje z niego NSwag klienta TypeScript, na którym stoi
// NotificationJobOrchestrator (frontend/libs/modules/notification/data-access). Pola nienazwane
// wprost w naszym modelu zdarzeń (ResultJson, ResultType, Exceptions, ExecutionTimes, ServiceId)
// zostają w kontrakcie z uczciwą wartością domyślną — patrz komentarze przy mapowaniu
// w `JobQueries` — zamiast fabrykować dane, których backend faktycznie nie ma.

/// <summary>Zadanie masowe w widoku odczytu Notification (replika).</summary>
public sealed record JobDto(
    Guid Uuid,
    string? QueueId,
    string? TrackingId,
    string? CommandJson,
    string? ResultJson,
    string? ResultType,
    string? Errors,
    string? Successes,
    string? Exceptions,
    bool IsComplete,
    bool UnRead,
    int ExecutionTimes,
    int? ServiceId,
    string? UserId,
    string? ClientId,
    string? UiMetadata,
    DateTime? ExecuteAfter,
    DateTime? ExpireOn);
