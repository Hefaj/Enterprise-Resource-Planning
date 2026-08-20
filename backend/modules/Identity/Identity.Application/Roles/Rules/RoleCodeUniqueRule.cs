using Erp.BuildingBlocks.Validation;

namespace Identity.Application.Roles;

/// <summary>Rola do utworzenia — kandydat na duplikat kodu.</summary>
/// <param name="Uuid">Identyfikator wygenerowany przez klienta (patrz <c>RoleCreateCommand.Uuid</c>
/// — tryb <c>Commands[]</c> jest jedynym sensownym trybem tworzenia, więc uuid zawsze przychodzi
/// z payloadu, nigdy z filtra).</param>
/// <param name="Code">Kod roli w formie WEJŚCIOWEJ, jeszcze nieznormalizowanej —
/// normalizację robi ta reguła, tak samo jak <c>Role.ValidateCode</c>.</param>
public sealed record RoleCreateTarget(Guid Uuid, string Code);

/// <summary>
/// Reguła wsadowa: kod nowej roli nie może kolidować z rolą już istniejącą w bazie ANI z inną
/// rolą tworzoną w TYM SAMYM wsadzie.
///
/// <para>Kolizja wewnątrz wsadu jest realnym przypadkiem — bez tego sprawdzenia zadanie
/// tworzące dwie role o tym samym kodzie przeszłoby pre-check w całości (żadna nie koliduje
/// z bazą) i rozbiłoby się dopiero o unikalny indeks <c>ix_role_code</c>, jeden element naraz,
/// w trybie izolacji <c>BulkCommandRunnera</c> — kosztowna ścieżka zamiast natychmiastowej
/// odpowiedzi. Zasada jak przy <c>ProductDuplicateRule</c>: pierwszy zgłaszający kod go zajmuje,
/// kolejni w tym samym wsadzie odpadają.</para>
/// </summary>
public sealed class RoleCodeUniqueRule : IBatchRule<RoleCreateTarget>
{
    private readonly IRoleQueries _queries;

    public RoleCodeUniqueRule(IRoleQueries queries)
    {
        _queries = queries;
    }

    /// <inheritdoc />
    public async Task ExecuteAsync(
        IReadOnlyList<RoleCreateTarget> items,
        Func<RoleCreateTarget, Guid> idSelector,
        ValidationTracker tracker,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(items);
        ArgumentNullException.ThrowIfNull(tracker);

        if (items.Count == 0)
        {
            return;
        }

        // Ta sama normalizacja co Role.ValidateCode — inaczej reguła porównywałaby wartości,
        // których zapis nigdy nie wygeneruje (np. różnica w wielkości liter).
        var normalizedCodes = items.Select(i => i.Code.Trim().ToLowerInvariant()).ToList();

        var existingInDb = new HashSet<string>(
            await _queries.GetExistingCodesAsync(normalizedCodes, cancellationToken).ConfigureAwait(false),
            StringComparer.Ordinal);

        var claimed = new Dictionary<string, Guid>(StringComparer.Ordinal);

        for (var i = 0; i < items.Count; i++)
        {
            var code = normalizedCodes[i];
            var uuid = idSelector(items[i]);

            if (existingInDb.Contains(code))
            {
                tracker.AddError(uuid, "role_code_duplicate", $"Rola o kodzie '{code}' już istnieje.");
                continue;
            }

            if (claimed.TryGetValue(code, out var claimant) && claimant != uuid)
            {
                tracker.AddError(
                    uuid,
                    "role_code_duplicate",
                    $"Kod '{code}' jest w tym samym zadaniu nadawany innej roli ({claimant}).");
                continue;
            }

            claimed[code] = uuid;
        }
    }
}
