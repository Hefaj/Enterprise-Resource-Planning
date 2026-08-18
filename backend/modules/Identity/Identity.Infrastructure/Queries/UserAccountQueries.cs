using Erp.BuildingBlocks.Api.Contracts;
using Identity.Application.Users;
using Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Identity.Infrastructure.Queries;

/// <summary>Odczyty użytkowników. Efektywne uprawnienia idą surowym rekursywnym CTE —
/// patrz uzasadnienie w <c>RoleQueries.IsDescendantAsync</c> i zapytanie referencyjne
/// w <c>docs/backend/identity-authz.md</c> §2.</summary>
public sealed class UserAccountQueries : IUserAccountQueries
{
    private readonly IdentityDbContext _dbContext;
    private readonly IdentityConnectionStringProvider _connectionStringProvider;

    public UserAccountQueries(IdentityDbContext dbContext, IdentityConnectionStringProvider connectionStringProvider)
    {
        _dbContext = dbContext;
        _connectionStringProvider = connectionStringProvider;
    }

    public async Task<SearchResponse> SearchAsync(SearchUserAccountRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _dbContext.UserAccounts.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var email = request.Email;
            query = query.Where(u => EF.Functions.ILike(u.Email, $"%{email}%"));
        }

        var totalCount = await query.CountAsync(cancellationToken).ConfigureAwait(false);

        var uuids = await query
            .OrderBy(u => u.Email)
            .ThenBy(u => u.Uuid)
            .Skip((Math.Max(request.Page, 1) - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(u => u.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new SearchResponse { Uuids = uuids, TotalCount = totalCount };
    }

    public async Task<List<UserAccountDto>> GetAsync(
        IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken)
    {
        var query = _dbContext.UserAccounts.AsNoTracking();

        if (uuids is { Count: > 0 })
        {
            var uuidList = uuids.ToList();
            query = query.Where(u => uuidList.Contains(u.Uuid));
        }

        var users = await query.ToListAsync(cancellationToken).ConfigureAwait(false);

        return users.Select(u => new UserAccountDto(
                u.Uuid,
                u.Email,
                u.DisplayName,
                u.IsActive,
                [.. u.RoleGrants.Select(g => new UserRoleGrantDto(g.RoleUuid, g.GrantedAt, g.GrantedBy, g.ExpiresAt))],
                [.. u.PermissionGrants.Select(g => new UserPermissionGrantDto(g.PermissionCode, g.GrantedAt, g.GrantedBy, g.Reason))]))
            .ToList();
    }

    /// <inheritdoc />
    public async Task<HashSet<string>> GetEffectivePermissionCodesAsync(Guid userUuid, CancellationToken cancellationToken)
    {
        const string sql = $"""
            WITH RECURSIVE effective_roles AS (
                SELECT role_uuid FROM {IdentityDbContext.SchemaName}.user_role
                WHERE user_uuid = @user_uuid AND (expires_at IS NULL OR expires_at > now())

                UNION

                SELECT rm.member_uuid
                FROM {IdentityDbContext.SchemaName}.role_member rm
                JOIN effective_roles er ON rm.container_uuid = er.role_uuid
            )
            SELECT permission_code FROM {IdentityDbContext.SchemaName}.role_permission
            WHERE role_uuid IN (SELECT role_uuid FROM effective_roles)

            UNION

            SELECT permission_code FROM {IdentityDbContext.SchemaName}.user_permission
            WHERE user_uuid = @user_uuid;
            """;

        var connection = await OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            await using var command = new NpgsqlCommand(sql, connection);
            command.Parameters.AddWithValue("user_uuid", userUuid);

            var codes = new HashSet<string>(StringComparer.Ordinal);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
            while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {
                codes.Add(reader.GetString(0));
            }

            return codes;
        }
        finally
        {
            await connection.DisposeAsync().ConfigureAwait(false);
        }
    }

    /// <inheritdoc />
    public async Task<List<EffectivePermissionSourceDto>> GetEffectivePermissionSourcesAsync(
        Guid userUuid, CancellationToken cancellationToken)
    {
        const string sql = $"""
            WITH RECURSIVE effective_roles AS (
                SELECT ur.role_uuid, ur.role_uuid AS direct_role_uuid
                FROM {IdentityDbContext.SchemaName}.user_role ur
                WHERE ur.user_uuid = @user_uuid AND (ur.expires_at IS NULL OR ur.expires_at > now())

                UNION

                SELECT rm.member_uuid, er.direct_role_uuid
                FROM {IdentityDbContext.SchemaName}.role_member rm
                JOIN effective_roles er ON rm.container_uuid = er.role_uuid
            )
            SELECT
                rp.permission_code,
                er.role_uuid AS source_role_uuid,
                r.code AS source_role_code,
                CASE WHEN er.role_uuid = er.direct_role_uuid THEN NULL ELSE er.direct_role_uuid END AS via_container_uuid
            FROM effective_roles er
            JOIN {IdentityDbContext.SchemaName}.role_permission rp ON rp.role_uuid = er.role_uuid
            JOIN {IdentityDbContext.SchemaName}.role r ON r.uuid = er.role_uuid

            UNION ALL

            SELECT up.permission_code, NULL, NULL, NULL
            FROM {IdentityDbContext.SchemaName}.user_permission up
            WHERE up.user_uuid = @user_uuid;
            """;

        var connection = await OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            await using var command = new NpgsqlCommand(sql, connection);
            command.Parameters.AddWithValue("user_uuid", userUuid);

            var results = new List<EffectivePermissionSourceDto>();
            await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
            while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {
                results.Add(new EffectivePermissionSourceDto(
                    reader.GetString(0),
                    reader.IsDBNull(1) ? null : reader.GetGuid(1),
                    reader.IsDBNull(2) ? null : reader.GetString(2),
                    reader.IsDBNull(3) ? null : reader.GetGuid(3)));
            }

            return results;
        }
        finally
        {
            await connection.DisposeAsync().ConfigureAwait(false);
        }
    }

    /// <summary>Zwraca dedykowane, otwarte połączenie zamiast dzielić `DbContext.Database
    /// .GetDbConnection()` — te dwie metody bywają wołane współbieżnie z innymi zapytaniami EF
    /// na tym samym (scoped) kontekście w tym samym żądaniu (np. `GetAsync` + efektywne
    /// uprawnienia w jednej odpowiedzi), a jedno połączenie ADO.NET nie obsłuży dwóch
    /// jednoczesnych poleceń.</summary>
    private async Task<NpgsqlConnection> OpenConnectionAsync(CancellationToken cancellationToken)
    {
        var connection = new NpgsqlConnection(_connectionStringProvider.ConnectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
        return connection;
    }
}
