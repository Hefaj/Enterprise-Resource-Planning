using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Projects;

/// <summary>Polityka SLA projektu. To byt należący do projektu, nie osobny agregat — konfiguracja
/// nie ma sensu bez projektu i zmienia się razem z nim.</summary>
public sealed class ProjectSlaPolicy
{
    private ProjectSlaPolicy()
    {
    }

    private ProjectSlaPolicy(Guid projectUuid, int? responseMinutes, int? resolutionMinutes)
    {
        ProjectUuid = projectUuid;
        ResponseMinutes = responseMinutes;
        ResolutionMinutes = resolutionMinutes;
    }

    public Guid ProjectUuid { get; private set; }
    public int? ResponseMinutes { get; private set; }
    public int? ResolutionMinutes { get; private set; }

    internal static ProjectSlaPolicy Create(Guid projectUuid, int? responseMinutes, int? resolutionMinutes)
    {
        ValidateMinutes(responseMinutes, "response");
        ValidateMinutes(resolutionMinutes, "resolution");

        if (responseMinutes is null && resolutionMinutes is null)
        {
            throw new DomainException(
                "taskmgmt.sla_policy_empty",
                "Polityka SLA musi określać czas reakcji albo realizacji.");
        }

        return new ProjectSlaPolicy(projectUuid, responseMinutes, resolutionMinutes);
    }

    /// <summary>Wyznacza termin realizacji według bazowego kalendarza roboczego modułu:
    /// sobota i niedziela nie zużywają minut SLA. Godziny pracy i święta są świadomie kolejną
    /// konfiguracją kalendarza, a nie ukrytą logiką w komendzie zgłoszenia.</summary>
    public DateTimeOffset? CalculateResolutionDueAt(DateTimeOffset from)
    {
        if (ResolutionMinutes is not { } remaining)
        {
            return null;
        }

        var cursor = from;
        while (remaining > 0)
        {
            if (cursor.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            {
                cursor = cursor.AddDays(1);
                continue;
            }

            var untilNextDay = cursor.Date.AddDays(1);
            var available = (int)Math.Ceiling((untilNextDay - cursor.DateTime).TotalMinutes);
            var consumed = Math.Min(remaining, Math.Max(available, 1));
            cursor = cursor.AddMinutes(consumed);
            remaining -= consumed;
        }

        return cursor;
    }

    private static void ValidateMinutes(int? value, string kind)
    {
        if (value is <= 0)
        {
            throw new DomainException(
                "taskmgmt.sla_policy_invalid",
                $"Czas SLA `{kind}` musi być dodatnią liczbą minut.");
        }
    }
}
