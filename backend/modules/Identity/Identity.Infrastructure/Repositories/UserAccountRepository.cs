using Identity.Application.Abstractions;
using Identity.Domain.Users;
using Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Identity.Infrastructure.Repositories;

public sealed class UserAccountRepository : IUserAccountRepository
{
    private readonly IdentityDbContext _dbContext;

    public UserAccountRepository(IdentityDbContext dbContext) => _dbContext = dbContext;

    public Task<UserAccount?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => _dbContext.UserAccounts.FirstOrDefaultAsync(u => u.Uuid == uuid, cancellationToken);

    public void Add(UserAccount userAccount) => _dbContext.UserAccounts.Add(userAccount);
}
