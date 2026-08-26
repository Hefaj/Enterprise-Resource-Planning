using Testcontainers.PostgreSql;
using Testcontainers.RabbitMq;
using Xunit;

namespace Erp.IntegrationTests;

/// <summary>
/// Postgres + RabbitMQ dla testów, które stawiają <b>dwa węzły Wolverine'a</b>.
///
/// <para>Osobny fixture od <see cref="PostgresFixture"/>, bo te testy potrzebują obu usług naraz
/// i są wyraźnie wolniejsze — trzymanie ich w tej samej kolekcji dokładałoby start brokera do
/// każdego testu blokad, który go nie potrzebuje.</para>
/// </summary>
public sealed class BrokerFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine")
        .WithDatabase("erp_messaging_tests")
        .WithUsername("erp")
        .WithPassword("erp")
        .Build();

    // Ten sam obraz co w docker-compose.yml.
    private readonly RabbitMqContainer _rabbit = new RabbitMqBuilder("rabbitmq:4-management-alpine")
        .WithUsername("erp")
        .WithPassword("erp")
        .Build();

    public string PostgresConnectionString { get; private set; } = string.Empty;

    public string RabbitConnectionString { get; private set; } = string.Empty;

    public async ValueTask InitializeAsync()
    {
        await Task.WhenAll(_postgres.StartAsync(), _rabbit.StartAsync());

        PostgresConnectionString = _postgres.GetConnectionString();
        RabbitConnectionString = _rabbit.GetConnectionString();
    }

    public async ValueTask DisposeAsync()
    {
        await _rabbit.DisposeAsync();
        await _postgres.DisposeAsync();
    }
}

/// <summary>Kolekcja dzieląca Postgres i RabbitMQ.</summary>
[CollectionDefinition(Name)]
public sealed class BrokerCollection : ICollectionFixture<BrokerFixture>
{
    public const string Name = "broker";
}
