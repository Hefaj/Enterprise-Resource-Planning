using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.FieldSchemes;
using TaskManagement.Domain.FieldSchemes;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

/// <summary>
/// Odczyty schematów pól i profilu projektu.
///
/// <para><b>Profil jest jednym źródłem prawdy dla obu końców</b>: front buduje z niego kolumny
/// tabeli i filtry, a <see cref="IssueQueries"/> czyta z niego mapę „kod pola → slot" przy
/// tłumaczeniu sortowania na <c>ORDER BY</c>. Dwa niezależne katalogi pól rozjechałyby się
/// pierwszego dnia po dodaniu pola (<c>docs/backend/task-management.md</c> §6).</para>
/// </summary>
public sealed class FieldSchemeQueries : IFieldSchemeQueries
{
    private readonly TaskManagementDbContext _dbContext;

    public FieldSchemeQueries(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public async Task<List<FieldSchemeDto>> SearchAsync(
        SearchFieldSchemeRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _dbContext.FieldSchemes.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Text))
        {
            var text = request.Text.Trim();
            query = query.Where(s => EF.Functions.ILike(s.Name, $"%{text}%"));
        }

        return await query
            .OrderBy(s => s.Name)
            .Select(s => new FieldSchemeDto(
                s.Uuid,
                s.Name,
                s.IsSystem,
                s.Fields
                    .OrderBy(f => f.OrderNo)
                    .Select(f => new FieldDefinitionDto(
                        f.Uuid,
                        f.Code,
                        f.NameKey,
                        f.DataType,
                        f.Slot,
                        f.OrderNo,
                        f.IsRequired,
                        EF.Property<List<string>>(f, "_options")))
                    .ToList()))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<ProjectFieldProfileDto> GetProjectProfileAsync(
        Guid projectUuid,
        CancellationToken cancellationToken)
    {
        var schemeUuid = await _dbContext.Projects
            .AsNoTracking()
            .Where(p => p.Uuid == projectUuid)
            .Select(p => p.FieldSchemeUuid)
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        if (schemeUuid is null)
        {
            // Projekt bez schematu pól zwraca pustą listę, a nie 404 — „ten projekt nie ma pól
            // własnych" jest odpowiedzią, nie błędem, i front ma z niej zbudować tabelę
            // bez kolumn projekto-specyficznych.
            return new ProjectFieldProfileDto(projectUuid, null, []);
        }

        var fields = await _dbContext.FieldDefinitions
            .AsNoTracking()
            .Where(f => f.SchemeUuid == schemeUuid.Value)
            .OrderBy(f => f.OrderNo)
            .Select(f => new ProjectFieldDto(
                f.Code,
                f.NameKey,
                f.DataType,
                f.Slot != FieldSlot.None,
                f.Slot != FieldSlot.None,
                f.IsRequired,
                f.OrderNo,
                EF.Property<List<string>>(f, "_options")))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new ProjectFieldProfileDto(projectUuid, schemeUuid, fields);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyDictionary<string, FieldSlot>> GetProjectSlotMapAsync(
        Guid projectUuid,
        CancellationToken cancellationToken)
    {
        var pairs = await _dbContext.FieldDefinitions
            .AsNoTracking()
            .Where(f => f.Slot != FieldSlot.None
                && _dbContext.Projects.Any(p => p.Uuid == projectUuid && p.FieldSchemeUuid == f.SchemeUuid))
            .Select(f => new { f.Code, f.Slot })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        // Porównanie bez rozróżniania wielkości liter, bo nazwa pola w sortowaniu przychodzi
        // z frontu i przechodzi po drodze przez URL i przez konfigurację tabeli.
        return pairs.ToDictionary(p => p.Code, p => p.Slot, StringComparer.OrdinalIgnoreCase);
    }
}
