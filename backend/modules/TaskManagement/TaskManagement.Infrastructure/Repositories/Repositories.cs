using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Projects;
using TaskManagement.Domain.Workflow;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Repositories;

/// <summary>Repozytorium zgłoszeń.</summary>
public sealed class IssueRepository : IIssueRepository
{
    private readonly TaskManagementDbContext _dbContext;

    public IssueRepository(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public Task<Issue?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => _dbContext.Issues.FirstOrDefaultAsync(i => i.Uuid == uuid, cancellationToken);

    /// <inheritdoc />
    public void Add(Issue issue) => _dbContext.Issues.Add(issue);
}

/// <summary>Repozytorium załączników.</summary>
public sealed class IssueAttachmentRepository : IIssueAttachmentRepository
{
    private readonly TaskManagementDbContext _dbContext;

    public IssueAttachmentRepository(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public Task<IssueAttachment?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => _dbContext.IssueAttachments.FirstOrDefaultAsync(a => a.Uuid == uuid, cancellationToken);

    /// <inheritdoc />
    public void Add(IssueAttachment attachment) => _dbContext.IssueAttachments.Add(attachment);
}

/// <summary>Repozytorium komentarzy.</summary>
public sealed class IssueCommentRepository : IIssueCommentRepository
{
    private readonly TaskManagementDbContext _dbContext;

    public IssueCommentRepository(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public Task<IssueComment?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => _dbContext.IssueComments.FirstOrDefaultAsync(c => c.Uuid == uuid, cancellationToken);

    /// <inheritdoc />
    public void Add(IssueComment comment) => _dbContext.IssueComments.Add(comment);
}

/// <summary>
/// Dopisywanie historii zgłoszenia.
///
/// <para>Sam <c>Add</c> i nic więcej — brak <c>Find</c> i <c>Remove</c> jest tutaj sygnałem,
/// a nie niedokończoną implementacją: wpisu historii nie da się zmienić ani cofnąć, bo to on
/// jest zapisem tego, co się stało.</para>
/// </summary>
public sealed class IssueActivityWriter : IIssueActivityWriter
{
    private readonly TaskManagementDbContext _dbContext;

    public IssueActivityWriter(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public void Add(IssueActivity activity) => _dbContext.IssueActivities.Add(activity);
}

/// <summary>Repozytorium projektów — ładuje agregat razem z członkami, bo rola zmienia się
/// metodą agregatu, a nie osobnym zapisem w tabeli podrzędnej.</summary>
public sealed class ProjectRepository : IProjectRepository
{
    private readonly TaskManagementDbContext _dbContext;

    public ProjectRepository(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public Task<Project?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => _dbContext.Projects
            .Include(p => p.Members)
            .Include(p => p.SlaPolicy)
            .FirstOrDefaultAsync(p => p.Uuid == uuid, cancellationToken);

    /// <inheritdoc />
    public void Add(Project project) => _dbContext.Projects.Add(project);
}

/// <summary>Repozytorium schematów stanów.</summary>
public sealed class WorkflowSchemeRepository : IWorkflowSchemeRepository
{
    private readonly TaskManagementDbContext _dbContext;

    public WorkflowSchemeRepository(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public Task<WorkflowScheme?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => Query().FirstOrDefaultAsync(s => s.Uuid == uuid, cancellationToken);

    /// <inheritdoc />
    public async Task<WorkflowScheme?> FindByProjectAsync(Guid projectUuid, CancellationToken cancellationToken)
    {
        var schemeUuid = await _dbContext.Projects
            .AsNoTracking()
            .Where(p => p.Uuid == projectUuid)
            .Select(p => (Guid?)p.WorkflowSchemeUuid)
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        return schemeUuid is null
            ? null
            : await FindAsync(schemeUuid.Value, cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public void Add(WorkflowScheme scheme) => _dbContext.WorkflowSchemes.Add(scheme);

    private IQueryable<WorkflowScheme> Query()
        => _dbContext.WorkflowSchemes
            .Include(s => s.States)
            .Include(s => s.Transitions);
}

/// <summary>Zapis licznika numeracji zakładanego razem z projektem.</summary>
public sealed class ProjectKeyCounterWriter : IProjectKeyCounterWriter
{
    private readonly TaskManagementDbContext _dbContext;

    public ProjectKeyCounterWriter(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public void Add(ProjectKeyCounter counter) => _dbContext.ProjectKeyCounters.Add(counter);
}

/// <summary>Repozytorium krawędzi powiązań.</summary>
public sealed class IssueLinkRepository : IIssueLinkRepository
{
    private readonly TaskManagementDbContext _dbContext;

    public IssueLinkRepository(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public Task<IssueLink?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => _dbContext.IssueLinks.FirstOrDefaultAsync(l => l.Uuid == uuid, cancellationToken);

    /// <inheritdoc />
    public void Add(IssueLink link) => _dbContext.IssueLinks.Add(link);

    /// <inheritdoc />
    public void Remove(IssueLink link) => _dbContext.IssueLinks.Remove(link);
}
