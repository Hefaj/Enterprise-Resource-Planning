using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Sales.Domain.Customers;
using Sales.Infrastructure.Persistence;

namespace Sales.Infrastructure.Seed;

/// <summary>
/// Garść deterministycznych klientów — wystarczająco, żeby ręcznie zweryfikować
/// <c>searchCustomer</c>/<c>getCustomer</c>/<c>batch-set-name</c>. Moduł istnieje wyłącznie
/// jako sprawdzian szablonu, więc bez rozmachu <c>CatalogSeeder</c> (bez profili wolumenu,
/// bez COPY binarnego) — kilkanaście wierszy przez zwykły EF w zupełności wystarcza.
///
/// Identyfikatory z generatora o stałym ziarnie — jak w <c>CatalogSeeder</c> — żeby dane
/// były powtarzalne między resetami bazy zamiast losowe przy każdym starcie.
/// </summary>
public sealed partial class SalesSeeder
{
    private const int RandomSeed = 20260814;

    private static readonly (string Name, string Email)[] SeedCustomers =
    [
        ("Anna Kowalska", "anna.kowalska@example.com"),
        ("Piotr Nowak", "piotr.nowak@example.com"),
        ("Katarzyna Wiśniewska", "katarzyna.wisniewska@example.com"),
        ("Marek Wójcik", "marek.wojcik@example.com"),
        ("Ewa Kamińska", "ewa.kaminska@example.com"),
        ("Tomasz Lewandowski", "tomasz.lewandowski@example.com"),
        ("Magdalena Zielińska", "magdalena.zielinska@example.com"),
        ("Krzysztof Szymański", "krzysztof.szymanski@example.com"),
        ("Agnieszka Dąbrowska", "agnieszka.dabrowska@example.com"),
        ("Michał Kozłowski", "michal.kozlowski@example.com"),
    ];

    private readonly SalesDbContext _dbContext;
    private readonly ILogger<SalesSeeder> _logger;

    public SalesSeeder(SalesDbContext dbContext, ILogger<SalesSeeder> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        if (await _dbContext.Customers.AnyAsync(cancellationToken).ConfigureAwait(false))
        {
            LogSeedSkipped(_logger);
            return;
        }

        var random = new Random(RandomSeed);

        foreach (var (name, email) in SeedCustomers)
        {
            _dbContext.Customers.Add(Customer.CreateWithUuid(NextUuid(random), name, email));
        }

        await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        LogSeedCompleted(_logger, SeedCustomers.Length);
    }

    /// <summary>Deterministyczny identyfikator z generatora o stałym ziarnie —
    /// <c>Guid.CreateVersion7()</c> nie nadaje się do seedu, bo opiera się na czasie.</summary>
    private static Guid NextUuid(Random random)
    {
        var bytes = new byte[16];
        random.NextBytes(bytes);
        return new Guid(bytes);
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Information, Message = "Sales zawiera już dane — seed pominięty.")]
    private static partial void LogSeedSkipped(ILogger logger);

    [LoggerMessage(EventId = 2, Level = LogLevel.Information, Message = "Seed zakończony: {Count} klientów.")]
    private static partial void LogSeedCompleted(ILogger logger, int count);
}
