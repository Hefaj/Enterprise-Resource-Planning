using Erp.BuildingBlocks.Application.Abstractions;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Projects;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

/// <summary>
/// Predykat widoczności zgłoszeń — <b>liczony po projekcie, joinem w SQL</b>, nie po
/// materializowanym ACL per zgłoszenie (<c>docs/backend/task-management.md</c> §10.1).
///
/// <para>Materializowany ACL wymusiła w DMS liczba dokumentów i to, że dostęp zmienia się tam
/// przy każdym kroku procesu. Tutaj liczba projektów jest o rzędy wielkości mniejsza, a dostęp
/// jest stabilny — join wystarcza i utrzymuje serwerową paginację oraz sortowanie.</para>
///
/// <para>Wyjątki od widoczności projektowej są dwa: projekt publiczny w organizacji oraz
/// zgłoszenie prywatne (<c>is_restricted</c>). Wewnątrz drugiego wyjątku krąg dopuszczonych
/// (zgłaszający, przypisany, <c>Lead</c> projektu, aktywny obserwator — PERM-003) rośnie bez
/// zmiany kształtu predykatu, więc to nie jest trzeci wyjątek. <b>Gdyby doszedł kolejny wyjątek
/// od widoczności projektowej jako takiej, właściwą odpowiedzią jest przejście na
/// materializowany ACL wzorem DMS</b> — nie dokładanie kolejnych warunków do tego predykatu.</para>
/// </summary>
internal static class IssueVisibility
{
    /// <summary>Identyfikator zalogowanego użytkownika. Nierozpoznany claim daje
    /// <see cref="Guid.Empty"/> — czyli dostęp wyłącznie do projektów publicznych, nigdy
    /// „do wszystkiego”.</summary>
    public static Guid CurrentUser(IExecutionContext executionContext)
    {
        ArgumentNullException.ThrowIfNull(executionContext);

        return Guid.TryParse(executionContext.UserId, out var userUuid) ? userUuid : Guid.Empty;
    }

    public static IQueryable<Issue> VisibleTo(
        this IQueryable<Issue> issues,
        TaskManagementDbContext dbContext,
        Guid userUuid)
    {
        ArgumentNullException.ThrowIfNull(issues);
        ArgumentNullException.ThrowIfNull(dbContext);

        return issues.Where(i =>
            dbContext.Projects.Any(p => p.Uuid == i.ProjectUuid
                && (p.IsPublic
                    || dbContext.ProjectMembers.Any(m => m.ProjectUuid == p.Uuid && m.UserUuid == userUuid)))
            && (!i.IsRestricted
                || i.ReporterUuid == userUuid
                || i.AssigneeUuid == userUuid
                || dbContext.ProjectMembers.Any(m =>
                    m.ProjectUuid == i.ProjectUuid
                    && m.UserUuid == userUuid
                    && m.Role == ProjectMemberRole.Lead)
                || dbContext.IssueWatchers.Any(w =>
                    w.IssueUuid == i.Uuid
                    && w.UserUuid == userUuid
                    && w.OptedOutAt == null)));
    }

    public static IQueryable<Project> VisibleTo(
        this IQueryable<Project> projects,
        TaskManagementDbContext dbContext,
        Guid userUuid)
    {
        ArgumentNullException.ThrowIfNull(projects);
        ArgumentNullException.ThrowIfNull(dbContext);

        return projects.Where(p => p.IsPublic
            || dbContext.ProjectMembers.Any(m => m.ProjectUuid == p.Uuid && m.UserUuid == userUuid));
    }
}
