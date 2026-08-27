using Erp.BuildingBlocks.Api.Contracts;
using Identity.Application.Users;
using Identity.Domain.Users;
using Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Identity.Infrastructure.Queries;

/// <summary>
/// Odczyty katalogu użytkowników.
///
/// <para>Osobno od <see cref="UserAccountQueries"/>, bo to zapytanie ma inny profil obciążenia:
/// wywołuje je picker przy każdym wpisanym znaku, więc dotyka wyłącznie <c>user_account</c>
/// i nie schodzi ani do ról, ani do rekursywnego CTE po uprawnieniach.</para>
/// </summary>
public sealed class UserDirectoryQueries : IUserDirectoryQueries
{
    /// <summary>Górna granica paczki uuidów w jednym żądaniu. Klient skleja adresatów z całej
    /// widocznej strony (autorzy komentarzy, przypisani w tabeli), więc paczka bywa duża —
    /// ale nie ma powodu, żeby była nieograniczona.</summary>
    private const int MaxUuidsPerRequest = 500;

    private readonly IdentityDbContext _dbContext;

    public UserDirectoryQueries(IdentityDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public async Task<SearchResponse> SearchAsync(
        SearchUserDirectoryRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _dbContext.UserAccounts.AsNoTracking();

        if (!request.IncludeInactive)
        {
            query = query.Where(u => u.IsActive);
        }

        if (!string.IsNullOrWhiteSpace(request.Query))
        {
            var needle = request.Query.Trim();

            // `ILIKE` przez `EF.Functions.ILike` — wielkość liter w nazwisku nie jest tym,
            // czym użytkownik pickera ma się przejmować.
            query = query.Where(u =>
                EF.Functions.ILike(u.DisplayName, $"%{needle}%")
                || EF.Functions.ILike(u.Email, $"%{needle}%"));
        }

        var totalCount = await query.CountAsync(cancellationToken).ConfigureAwait(false);

        var uuids = await query
            .OrderBy(u => u.DisplayName)
            .ThenBy(u => u.Uuid)
            .Skip((Math.Max(request.Page, 1) - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(u => u.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new SearchResponse { Uuids = uuids, TotalCount = totalCount };
    }

    /// <inheritdoc />
    public async Task<List<UserDirectoryDto>> GetAsync(
        IReadOnlyCollection<Guid>? uuids,
        CancellationToken cancellationToken)
    {
        if (uuids is null || uuids.Count == 0)
        {
            return [];
        }

        var wanted = uuids.Distinct().Take(MaxUuidsPerRequest).ToList();

        return await Project(_dbContext.UserAccounts.AsNoTracking().Where(u => wanted.Contains(u.Uuid)))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    private static IQueryable<UserDirectoryDto> Project(IQueryable<UserAccount> users)
        => users.Select(u => new UserDirectoryDto(u.Uuid, u.DisplayName, u.Email, u.IsActive));
}
