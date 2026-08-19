using Identity.Domain.Audit;

namespace Identity.Application.Abstractions;

/// <summary>Zapis wpisu audytowego. Implementacja tylko dodaje encję do kontekstu
/// (<c>Identity.Infrastructure.Repositories.GrantAuditWriter</c>) — faktyczny zapis do bazy
/// robi wołający przez <see cref="IUnitOfWork.SaveChangesAsync"/>, w tej samej transakcji co
/// zmiana, którą wpis opisuje.</summary>
public interface IGrantAuditWriter
{
    Task RecordAsync(GrantAuditEntry entry, CancellationToken cancellationToken);
}
