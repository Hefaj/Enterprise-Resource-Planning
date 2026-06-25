using System;
using System.Collections.Generic;

namespace NotificationBff;

public record JobDto(
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
    DateTime? ExpireOn
);

public static class NotificationMockData
{
    public static readonly List<JobDto> Jobs = GenerateMockJobs();

    private static List<JobDto> GenerateMockJobs()
    {
        var list = new List<JobDto>();
        for (int i = 1; i <= 50; i++)
        {
            var uuid = Guid.NewGuid();
            var trackingId = uuid.ToString();
            var isComplete = i % 3 != 0;
            var hasErrors = i % 5 == 0;
            list.Add(new JobDto(
                Uuid: uuid,
                QueueId: $"queue-{i % 5}",
                TrackingId: trackingId,
                CommandJson: $"{{\"CommandName\":\"TestCommand{i}\"}}",
                ResultJson: isComplete && !hasErrors ? $"{{\"Result\":\"Success-{i}\"}}" : null,
                ResultType: isComplete && !hasErrors ? "TestResult" : null,
                Errors: hasErrors ? $"Error occurred in job {i}" : null,
                Successes: isComplete && !hasErrors ? "Job completed successfully" : null,
                Exceptions: null,
                IsComplete: isComplete,
                UnRead: i % 2 == 0,
                ExecutionTimes: i % 4,
                ServiceId: 100 + i,
                UserId: $"user-{i % 3}",
                ClientId: $"client-{i % 2}",
                UiMetadata: $"{{\"commandName\":\"TestCommand{i}\",\"timestamp\":\"{DateTime.UtcNow.AddMinutes(-i):O}\"}}",
                ExecuteAfter: DateTime.UtcNow.AddMinutes(-i),
                ExpireOn: DateTime.UtcNow.AddDays(7)
            ));
        }
        return list;
    }
}
