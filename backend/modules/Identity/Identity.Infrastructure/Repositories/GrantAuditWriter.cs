using Identity.Application.Abstractions;
using Identity.Domain.Audit;
using Identity.Infrastructure.Persistence;

namespace Identity.Infrastructure.Repositories;

/// <inheritdoc cref="IGrantAuditWriter" />
public sealed class GrantAuditWriter : IGrantAuditWriter
{
    private readonly IdentityDbContext _dbContext;

    public GrantAuditWriter(IdentityDbContext dbContext) => _dbContext = dbContext;

    public Task RecordAsync(GrantAuditEntry entry, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(entry);

        // Wyłącznie Add() — SaveChangesAsync robi wołający (IUnitOfWork), żeby wpis audytowy
        // zapisał się w TEJ SAMEJ transakcji co zmiana, którą opisuje.
        _dbContext.GrantAuditEntries.Add(entry);
        return Task.CompletedTask;
    }
}
