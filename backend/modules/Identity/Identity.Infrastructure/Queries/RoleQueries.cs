using Erp.BuildingBlocks.Api.Contracts;
using Identity.Application.Roles;
using Identity.Domain.Roles;
using Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Identity.Infrastructure.Queries;

/// <summary>Odczyty ról, bezpośrednio na EF Core — patrz wzorzec w
/// <c>Catalog.Infrastructure.Queries.ProductQueries</c>. <see cref="IsDescendantAsync"/> jest
/// wyjątkiem: rekursywne CTE nie da się wyrazić w LINQ-to-Entities, więc idzie surowym SQL-em
/// przez ADO.NET (ten sam wzorzec co <c>CatalogSeeder</c>), tak samo jak
/// <c>CategoryClosureMaintainer</c> robi to dla drzewa kategorii.</summary>
public sealed class RoleQueries : IRoleQueries
{
    private readonly IdentityDbContext _dbContext;
    private readonly IdentityConnectionStringProvider _connectionStringProvider;

    public RoleQueries(IdentityDbContext dbContext, IdentityConnectionStringProvider connectionStringProvider)
    {
        _dbContext = dbContext;
        _connectionStringProvider = connectionStringProvider;
    }

    public async Task<SearchResponse> SearchAsync(SearchRoleRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = ApplyFilters(request);

        var totalCount = await query.CountAsync(cancellationToken).ConfigureAwait(false);

        var uuids = await query
            .OrderBy(r => r.Name)
            .ThenBy(r => r.Uuid)
            .Skip((Math.Max(request.Page, 1) - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(r => r.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new SearchResponse { Uuids = uuids, TotalCount = totalCount };
    }

    /// <inheritdoc />
    public async Task<List<Guid>> GetMatchingUuidsAsync(SearchRoleRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        // Bez stronicowania — operacja masowa obejmuje cały zbiór pasujący do filtra.
        return await ApplyFilters(request)
            .OrderBy(r => r.Uuid)
            .Select(r => r.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <summary>Filtry współdzielone przez <see cref="SearchAsync"/> i
    /// <see cref="GetMatchingUuidsAsync"/> — jedno miejsce, w którym filtr może się rozjechać,
    /// zamiast dwóch.</summary>
    private IQueryable<Role> ApplyFilters(SearchRoleRequest request)
    {
        var query = _dbContext.Roles.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            var name = request.Name;
            query = query.Where(r => EF.Functions.ILike(r.Name, $"%{name}%"));
        }

        return query;
    }

    /// <inheritdoc />
    public async Task<List<Guid>> GetExistingUuidsAsync(
        IReadOnlyCollection<Guid> uuids,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(uuids);

        if (uuids.Count == 0)
        {
            return [];
        }

        var uuidList = uuids as List<Guid> ?? uuids.ToList();

        return await _dbContext.Roles
            .AsNoTracking()
            .Where(r => uuidList.Contains(r.Uuid))
            .Select(r => r.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<List<string>> GetExistingCodesAsync(
        IReadOnlyCollection<string> codes,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(codes);

        if (codes.Count == 0)
        {
            return [];
        }

        // Ta sama normalizacja co Role.ValidateCode — Code w bazie jest zawsze przycięty
        // i pisany małymi literami, więc porównanie musi iść po tej samej formie.
        var normalizedCodes = codes
            .Select(c => c.Trim().ToLowerInvariant())
            .Distinct(StringComparer.Ordinal)
            .ToList();

        return await _dbContext.Roles
            .AsNoTracking()
            .Where(r => normalizedCodes.Contains(r.Code))
            .Select(r => r.Code)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<List<RoleMembershipEdge>> GetAllMembershipEdgesAsync(CancellationToken cancellationToken)
    {
        const string sql = $"""
            SELECT container_uuid, member_uuid FROM {IdentityDbContext.SchemaName}.role_member;
            """;

        // Dedykowane połączenie, tak jak IsDescendantAsync niżej — role_member jest kolekcją
        // własną (OwnsMany), bez osobnego DbSet do odpytania przez LINQ-to-Entities.
        await using var connection = new NpgsqlConnection(_connectionStringProvider.ConnectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

        await using var command = new NpgsqlCommand(sql, connection);

        var edges = new List<RoleMembershipEdge>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            edges.Add(new RoleMembershipEdge(reader.GetGuid(0), reader.GetGuid(1)));
        }

        return edges;
    }

    public async Task<List<RoleDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken)
    {
        var query = _dbContext.Roles.AsNoTracking();

        if (uuids is { Count: > 0 })
        {
            var uuidList = uuids.ToList();
            query = query.Where(r => uuidList.Contains(r.Uuid));
        }

        var roles = await query.ToListAsync(cancellationToken).ConfigureAwait(false);

        return roles
            .Select(r => new RoleDto(r.Uuid, r.Code, r.Name, r.Description, r.IsSystem, r.Permissions, r.MemberRoleUuids))
            .ToList();
    }

    /// <inheritdoc />
    public async Task<bool> IsDescendantAsync(Guid ancestorRoleUuid, Guid roleUuid, CancellationToken cancellationToken)
    {
        if (ancestorRoleUuid == roleUuid)
        {
            return true;
        }

        const string sql = $"""
            WITH RECURSIVE descendants AS (
                SELECT member_uuid AS role_uuid
                FROM {IdentityDbContext.SchemaName}.role_member
                WHERE container_uuid = @ancestor_uuid

                UNION

                SELECT rm.member_uuid
                FROM {IdentityDbContext.SchemaName}.role_member rm
                JOIN descendants d ON rm.container_uuid = d.role_uuid
            )
            SELECT EXISTS(SELECT 1 FROM descendants WHERE role_uuid = @target_uuid);
            """;

        // Dedykowane połączenie z osobno przechowywanego connection stringa — patrz
        // uzasadnienie w IdentityConnectionStringProvider (Npgsql nie utrzymuje hasła
        // w `_dbContext.Database.GetDbConnection().ConnectionString` po otwarciu połączenia).
        await using var connection = new NpgsqlConnection(_connectionStringProvider.ConnectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("ancestor_uuid", ancestorRoleUuid);
        command.Parameters.AddWithValue("target_uuid", roleUuid);

        var result = await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false);
        return result is true;
    }
}
