using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Repositories;

/// <summary>Repozytorium schematów typów zgłoszeń — razem z typami, bo to jeden agregat
/// (wzorzec identyczny jak <see cref="WorkflowSchemeRepository"/>).</summary>
public sealed class IssueTypeSchemeRepository : IIssueTypeSchemeRepository
{
    private readonly TaskManagementDbContext _dbContext;

    public IssueTypeSchemeRepository(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public Task<IssueTypeScheme?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => Query().FirstOrDefaultAsync(s => s.Uuid == uuid, cancellationToken);

    /// <inheritdoc />
    public async Task<IssueTypeScheme?> FindByProjectAsync(Guid projectUuid, CancellationToken cancellationToken)
    {
        var schemeUuid = await _dbContext.Projects
            .AsNoTracking()
            .Where(p => p.Uuid == projectUuid)
            .Select(p => (Guid?)p.IssueTypeSchemeUuid)
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        return schemeUuid is null
            ? null
            : await FindAsync(schemeUuid.Value, cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public void Add(IssueTypeScheme scheme) => _dbContext.IssueTypeSchemes.Add(scheme);

    private IQueryable<IssueTypeScheme> Query()
        => _dbContext.IssueTypeSchemes.Include(s => s.Types);
}

/// <summary>
/// Sonda zajętości typu zgłoszenia.
///
/// <para>Pyta wprost o liczbę wierszy <c>issue</c> z danym <c>type_uuid</c> — w odróżnieniu od
/// <see cref="FieldUsageProbe"/> nie ma tu jsonb do przeszukania, więc zwykłe zapytanie LINQ
/// wystarcza. Liczba (nie tylko fakt użycia) jedzie wprost do komunikatu odrzucenia (TYP-004).</para>
/// </summary>
public sealed class IssueTypeUsageProbe : IIssueTypeUsageProbe
{
    private readonly TaskManagementDbContext _dbContext;

    public IssueTypeUsageProbe(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public Task<int> CountByTypeAsync(Guid typeUuid, CancellationToken cancellationToken)
        => _dbContext.Issues.AsNoTracking().CountAsync(i => i.TypeUuid == typeUuid, cancellationToken);
}
