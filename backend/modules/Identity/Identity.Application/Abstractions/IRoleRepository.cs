using Identity.Domain.Roles;

namespace Identity.Application.Abstractions;

/// <summary>Dostęp do agregatu <see cref="Role"/> po stronie zapisu — patrz uzasadnienie
/// przy <c>Catalog.Application.Abstractions.IProductRepository</c>.</summary>
public interface IRoleRepository
{
    Task<Role?> FindAsync(Guid uuid, CancellationToken cancellationToken);

    Task<Role?> FindByCodeAsync(string code, CancellationToken cancellationToken);

    void Add(Role role);
}
