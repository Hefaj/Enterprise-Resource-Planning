using Erp.BuildingBlocks.Domain;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Abstractions;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Repositories;

/// <summary>
/// Nadaje klucze czytelne (<c>DEV-123</c>) jednym <c>UPDATE … RETURNING</c> na wierszu licznika
/// projektu (<c>docs/modules/task-management/domain.md</c> §4).
///
/// <para><b>Dlaczego surowy SQL, a nie wczytanie licznika przez EF.</b> Odczyt-modyfikacja-zapis
/// przez śledzenie zmian to klasyczny wyścig: dwie instancje odczytają ten sam <c>next_number</c>,
/// a druga dostanie naruszenie unikalności na <c>issue.key</c>. <c>UPDATE … RETURNING</c> blokuje
/// wiersz licznika na czas transakcji, więc przy dużym natężeniu tworzenia zgłoszeń w jednym
/// projekcie je <b>serializuje</b> — akceptowalne, bo tworzenie zgłoszenia jest operacją ludzką.</para>
///
/// <para><b>Transakcja.</b> Zapytanie idzie na połączeniu bieżącego <c>DbContext</c>, więc
/// wpada do transakcji otwartej przez <c>BulkCommandRunner</c> na czas chunka — a każda mutacja
/// w tym module idzie przez runner. Wykonanie komendy poza runnerem, bez jawnej transakcji,
/// zatwierdziłoby przeskok licznika niezależnie od losu zgłoszenia; skutkiem jest dziura
/// w numeracji, nie duplikat — ale to jest właśnie ta wada, dla której odpadła sekwencja
/// Postgresa, więc nowe ścieżki wywołania muszą trzymać granicę transakcji.</para>
/// </summary>
public sealed class IssueKeyAllocator : IIssueKeyAllocator
{
    private readonly TaskManagementDbContext _dbContext;

    public IssueKeyAllocator(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public async Task<string> AllocateAsync(Guid projectUuid, CancellationToken cancellationToken)
    {
        var keys = await AllocateRangeAsync(projectUuid, 1, cancellationToken).ConfigureAwait(false);
        return keys[0];
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<string>> AllocateRangeAsync(
        Guid projectUuid,
        int count,
        CancellationToken cancellationToken)
    {
        if (count < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(count), count, "Liczba kluczy musi być dodatnia.");
        }

        // Jeden przeskok licznika na całą paczkę — chunk operacji masowej „utwórz 500 zgłoszeń”
        // nie może wykonać 500 blokujących UPDATE-ów na tym samym wierszu.
        var allocation = await _dbContext.Database
            .SqlQuery<KeyAllocation>($"""
                UPDATE taskmgmt.project_key_counter
                   SET next_number = next_number + {count}
                 WHERE project_uuid = {projectUuid}
             RETURNING prefix, next_number - {count} AS first_number
             """)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        if (allocation.Count == 0)
        {
            throw new DomainException(
                "taskmgmt.project_key_counter_missing",
                $"Projekt {projectUuid} nie ma licznika numeracji — zgłoszenia nie da się utworzyć.");
        }

        var (prefix, firstNumber) = (allocation[0].Prefix, allocation[0].FirstNumber);

        return [.. Enumerable.Range(firstNumber, count).Select(number => $"{prefix}-{number}")];
    }

    /// <summary>
    /// Wynik rezerwacji: prefiks projektu i pierwszy numer z przydzielonego zakresu.
    ///
    /// <para><b>Aliasy w SQL muszą być w <c>snake_case</c></b>: <c>SqlQuery</c> szuka kolumn
    /// po nazwach właściwości przepuszczonych przez konwencję nazewniczą kontekstu
    /// (<c>UseSnakeCaseNamingConvention</c>), więc <c>FirstNumber</c> odpowiada kolumnie
    /// <c>first_number</c>. Alias <c>"FirstNumber"</c> kompiluje się i wykonuje w bazie, ale
    /// materializacja wywala się dopiero w runtime na „required column not present".</para>
    /// </summary>
    private sealed record KeyAllocation(string Prefix, int FirstNumber);
}
