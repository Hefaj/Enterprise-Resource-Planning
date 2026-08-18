using Identity.Domain.Users;

namespace Identity.Application.Abstractions;

/// <summary>Dostęp do agregatu <see cref="UserAccount"/> po stronie zapisu.</summary>
public interface IUserAccountRepository
{
    Task<UserAccount?> FindAsync(Guid uuid, CancellationToken cancellationToken);

    void Add(UserAccount userAccount);
}
