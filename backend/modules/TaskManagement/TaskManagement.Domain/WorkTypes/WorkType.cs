using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.WorkTypes;

/// <summary>
/// Rodzaj pracy — słownik dla wpisu czasu (<c>TIME-001</c> AC2), wzorem
/// <see cref="Tags.Tag"/>: <see cref="ProjectUuid"/> <c>null</c> znaczy rodzaj globalny,
/// dostępny na każdym projekcie, obok ewentualnych rodzajów własnych projektu.
/// </summary>
public sealed class WorkType : AggregateRoot
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private WorkType()
    {
    }

    private WorkType(Guid uuid, Guid? projectUuid, string name) : base(uuid)
    {
        ProjectUuid = projectUuid;
        Name = name;
    }

    public Guid? ProjectUuid { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public static WorkType CreateWithUuid(Guid uuid, Guid? projectUuid, string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("taskmgmt.work_type_name_empty", "Nazwa rodzaju pracy nie może być pusta.");
        }

        return new WorkType(uuid, projectUuid == Guid.Empty ? null : projectUuid, name.Trim());
    }
}
