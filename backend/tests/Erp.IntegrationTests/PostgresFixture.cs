using Testcontainers.PostgreSql;
using Xunit;

namespace Erp.IntegrationTests;

/// <summary>
/// Jeden kontener Postgresa na całą kolekcję testów.
///
/// <para><b>Dlaczego kontener, a nie baza deweloperska.</b> Te testy sprawdzają zachowanie przy
/// <b>współbieżności</b> — blokady wierszy, advisory locki, wyścigi na starcie. Uruchomione na
/// współdzielonej bazie mieszałyby własne wyścigi z cudzymi i dawały wyniki zależne od tego,
/// co akurat robi deweloper obok. Kontener daje im wyłączność, a przy okazji sprawia, że CI
/// nie potrzebuje żadnej infrastruktury poza Dockerem.</para>
///
/// <para><b>Jeden na kolekcję, nie jeden na test.</b> Start kontenera to kilka sekund; izolację
/// między testami daje osobny <b>schemat</b> per test (patrz <see cref="NewSchemaName"/>),
/// co jest tanie i wystarczające — schematy nie widzą nawzajem swoich blokad wierszy.</para>
/// </summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    // Ten sam obraz co w docker-compose.yml — testy mają sprawdzać ten Postgres,
    // na którym system faktycznie chodzi, a nie „jakiś".
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:17-alpine")
        .WithDatabase("erp_tests")
        .WithUsername("erp")
        .WithPassword("erp")
        .Build();

    public string ConnectionString { get; private set; } = string.Empty;

    public async ValueTask InitializeAsync()
    {
        await _container.StartAsync();
        ConnectionString = _container.GetConnectionString();
    }

    public async ValueTask DisposeAsync() => await _container.DisposeAsync();

    /// <summary>Nazwa schematu unikalna dla jednego testu — izolacja bez restartu kontenera.</summary>
    public static string NewSchemaName(string prefix) => $"{prefix}_{Guid.NewGuid():N}"[..Math.Min(60, prefix.Length + 33)];

    /// <summary>
    /// Zakłada w tym samym kontenerze <b>osobną bazę</b> i zwraca do niej łańcuch połączenia.
    ///
    /// <para>Schemat wystarcza tam, gdzie testowany jest jeden mechanizm. Nie wystarcza tam, gdzie
    /// testowany jest <b>start na pustej bazie</b>: migracje modułu mają zaszyty własny schemat
    /// i własną tabelę historii, więc dwa takie testy w jednej bazie widziałyby nawzajem swoje
    /// migracje. Osobna baza kosztuje ułamek sekundy i usuwa całą klasę takich sprzężeń.</para>
    /// </summary>
    public async Task<string> CreateDatabaseAsync(string name, CancellationToken cancellationToken)
    {
        var database = $"{name}_{Guid.NewGuid():N}"[..Math.Min(60, name.Length + 33)];

        await _container.ExecScriptAsync($"CREATE DATABASE \"{database}\";");

        return new Npgsql.NpgsqlConnectionStringBuilder(ConnectionString) { Database = database }.ConnectionString;
    }
}

/// <summary>Kolekcja dzieląca jeden kontener Postgresa.</summary>
[CollectionDefinition(Name)]
public sealed class PostgresCollection : ICollectionFixture<PostgresFixture>
{
    public const string Name = "postgres";
}
