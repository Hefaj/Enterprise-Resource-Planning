using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.FieldSchemes;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Repositories;

/// <summary>Repozytorium schematów pól — razem z definicjami, bo to jeden agregat.</summary>
public sealed class FieldSchemeRepository : IFieldSchemeRepository
{
    private readonly TaskManagementDbContext _dbContext;

    public FieldSchemeRepository(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public Task<FieldScheme?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => _dbContext.FieldSchemes
            .Include(s => s.Fields)
            .FirstOrDefaultAsync(s => s.Uuid == uuid, cancellationToken);

    /// <inheritdoc />
    public async Task<FieldScheme?> FindByProjectAsync(Guid projectUuid, CancellationToken cancellationToken)
    {
        var schemeUuid = await _dbContext.Projects
            .AsNoTracking()
            .Where(p => p.Uuid == projectUuid)
            .Select(p => p.FieldSchemeUuid)
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        return schemeUuid is null
            ? null
            : await FindAsync(schemeUuid.Value, cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public void Add(FieldScheme scheme) => _dbContext.FieldSchemes.Add(scheme);
}

/// <summary>
/// Sonda zajętości pola.
///
/// <para>Pyta o <b>klucz w jsonb</b>, a nie o slot: slot bywa pusty (<c>FieldSlot.None</c>),
/// a wartość i tak istnieje. Zapytanie idzie po wszystkich projektach używających schematu —
/// pole zwolnione w jednym projekcie, a używane w drugim, nadal trzyma swój slot.</para>
/// </summary>
public sealed class FieldUsageProbe : IFieldUsageProbe
{
    private readonly TaskManagementDbContext _dbContext;

    public FieldUsageProbe(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public async Task<bool> IsUsedAsync(
        Guid fieldSchemeUuid,
        string fieldCode,
        CancellationToken cancellationToken)
    {
        // Surowy SQL, bo pytanie brzmi „czy jsonb ma ten klucz", a `jsonb_exists` nie ma
        // odpowiednika w LINQ. To jedno zapytanie w warstwie infrastruktury — dokładnie tam,
        // gdzie wolno znać SQL — zamiast wciągania całej kolumny do pamięci po to, żeby
        // sprawdzić obecność klucza.
        var used = await _dbContext.Database
            .SqlQuery<bool>(
                $"""
                 -- Alias `Value` jest wymagany: `SqlQuery<T>` dla typu skalarnego szuka
                 -- kolumny o dokładnie takiej nazwie i bez niego wywraca się na
                 -- `42703: column s.Value does not exist` dopiero w czasie działania.
                 select exists (
                     select 1
                     from taskmgmt.issue i
                     join taskmgmt.project p on p.uuid = i.project_uuid
                     where p.field_scheme_uuid = {fieldSchemeUuid}
                       and jsonb_exists(i.custom_fields, {fieldCode})
                 ) as "Value"
                 """)
            .SingleAsync(cancellationToken)
            .ConfigureAwait(false);

        return used;
    }
}
