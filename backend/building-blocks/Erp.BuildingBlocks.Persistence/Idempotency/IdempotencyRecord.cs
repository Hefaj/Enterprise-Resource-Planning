using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Erp.BuildingBlocks.Persistence.Idempotency;

/// <summary>
/// Wpis rejestru idempotencji: „operacja o tym kluczu już się wykonała i dała TAKI wynik".
///
/// <para><b>To nie jest agregat</b> i celowo nie dziedziczy po <c>AggregateRoot</c> — nie ma
/// reguł biznesowych, nie emituje zdarzeń i nie potrzebuje tokenu współbieżności. Wyścig dwóch
/// żądań rozstrzyga tu klucz główny, a nie <c>xmin</c>: przegrany dostaje naruszenie unikalności
/// i to jest właściwe zachowanie, bo oznacza, że ktoś już wykonuje tę samą operację.</para>
///
/// <para>Tabela mieszka w schemacie modułu, razem z danymi, których dotyczy — inaczej klucz
/// i skutek nie mogłyby być jednym commitem.</para>
/// </summary>
public sealed class IdempotencyRecord
{
    /// <summary>Klucz: <c>X-Request-Id</c> klienta razem z nazwą operacji.</summary>
    public string Key { get; private set; } = string.Empty;

    /// <summary>Nazwa operacji — typ komendy albo typ komendy zadania masowego.</summary>
    public string Operation { get; private set; } = string.Empty;

    /// <summary>Kto wykonał operację; wyłącznie do diagnostyki.</summary>
    public string? UserId { get; private set; }

    /// <summary>Serializowany wynik pierwszego wykonania, oddawany przy powtórce.</summary>
    public string? ResultJson { get; private set; }

    /// <summary>Kiedy wpis powstał.</summary>
    public DateTimeOffset CreatedAt { get; private set; }

    /// <summary>Kiedy przestaje obowiązywać — po tej chwili powtórka wykona operację normalnie.</summary>
    public DateTimeOffset ExpiresAt { get; private set; }

    /// <summary>Wymagane przez EF Core.</summary>
    private IdempotencyRecord()
    {
    }

    /// <summary>Tworzy wpis dla wykonanej właśnie operacji.</summary>
    public static IdempotencyRecord Create(
        string key,
        string operation,
        string? userId,
        string? resultJson,
        DateTimeOffset now,
        TimeSpan retention)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        ArgumentException.ThrowIfNullOrWhiteSpace(operation);

        return new IdempotencyRecord
        {
            Key = key,
            Operation = operation,
            UserId = userId,
            ResultJson = resultJson,
            CreatedAt = now,
            ExpiresAt = now + retention,
        };
    }
}

/// <summary>Mapowanie EF dla <see cref="IdempotencyRecord"/>.</summary>
public sealed class IdempotencyRecordConfiguration : IEntityTypeConfiguration<IdempotencyRecord>
{
    public void Configure(EntityTypeBuilder<IdempotencyRecord> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("idempotency_key");

        // Klucz główny na wartości od klienta — to on wymusza „raz i tylko raz" przy dwóch
        // równoległych żądaniach. Ograniczenie długości jest tu bramką na śmieciowy nagłówek:
        // klucz idzie wprost do indeksu, a klient nie ma powodu wysyłać niczego dłuższego niż uuid.
        builder.HasKey(r => r.Key);
        builder.Property(r => r.Key).HasMaxLength(320);

        builder.Property(r => r.Operation).HasMaxLength(256).IsRequired();
        builder.Property(r => r.UserId).HasMaxLength(128);
        builder.Property(r => r.ResultJson).HasColumnType("jsonb");

        // Sprzątanie wygasłych wpisów to jedyne zapytanie, które NIE trafia w klucz główny.
        builder.HasIndex(r => r.ExpiresAt);
    }
}
