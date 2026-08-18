using Identity.Application.Abstractions;
using Identity.Domain.Roles;
using Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Identity.Infrastructure.Repositories;

public sealed class RoleRepository : IRoleRepository
{
    private readonly IdentityDbContext _dbContext;

    public RoleRepository(IdentityDbContext dbContext) => _dbContext = dbContext;

    public Task<Role?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => _dbContext.Roles.FirstOrDefaultAsync(r => r.Uuid == uuid, cancellationToken);

    public Task<Role?> FindByCodeAsync(string code, CancellationToken cancellationToken)
        => _dbContext.Roles.FirstOrDefaultAsync(r => r.Code == code, cancellationToken);

    public void Add(Role role) => _dbContext.Roles.Add(role);
}
