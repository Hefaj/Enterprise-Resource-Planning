using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Projects;

/// <summary>Rola użytkownika w projekcie.</summary>
public enum ProjectMemberRole
{
    Viewer = 0,
    Contributor = 1,
    Lead = 2,
}

/// <summary>
/// Członkostwo w projekcie — <b>atrybut nadania, nigdy osobny kod uprawnienia</b>.
///
/// <para>Identity odpowiada „czy w ogóle wolno ci ruszać zgłoszenia”, ten wiersz —
/// „w których projektach”. Odwrotny podział (kod uprawnienia per projekt) rozsadza katalog
/// uprawnień z liczbą działów, patrz <c>docs/backend/identity-authz.md</c> §9
/// i <c>docs/backend/task-management.md</c> §10.2.</para>
/// </summary>
public sealed class ProjectMember : Entity
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private ProjectMember()
    {
    }

    private ProjectMember(Guid uuid, Guid userUuid, ProjectMemberRole role) : base(uuid)
    {
        UserUuid = userUuid;
        Role = role;
    }

    public Guid ProjectUuid { get; private set; }

    public Guid UserUuid { get; private set; }

    public ProjectMemberRole Role { get; private set; }

    internal static ProjectMember Create(Guid uuid, Guid userUuid, ProjectMemberRole role)
    {
        if (userUuid == Guid.Empty)
        {
            throw new DomainException(
                "taskmgmt.project_member_user_empty",
                "Członek projektu musi wskazywać użytkownika.");
        }

        return new ProjectMember(uuid, userUuid, role);
    }

    internal void SetRole(ProjectMemberRole role) => Role = role;
}
