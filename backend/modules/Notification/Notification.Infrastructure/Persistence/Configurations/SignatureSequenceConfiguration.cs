using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Notification.Infrastructure.Realtime;

namespace Notification.Infrastructure.Persistence.Configurations;

/// <summary>
/// Mapowanie <see cref="SignatureSequence"/>.
///
/// <para>Klucz główny na <c>signature</c>, a nie na sztucznym <c>uuid</c>: to on jest kluczem
/// naturalnym i to po nim idzie atomowy <c>INSERT … ON CONFLICT DO UPDATE</c> zwiększający
/// licznik. Drugi klucz byłby tu wyłącznie kolumną do utrzymania.</para>
/// </summary>
public sealed class SignatureSequenceConfiguration : IEntityTypeConfiguration<SignatureSequence>
{
    public void Configure(EntityTypeBuilder<SignatureSequence> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("signature_sequence");
        builder.HasKey(s => s.Signature);

        builder.Property(s => s.Signature).HasMaxLength(128).IsRequired();
        builder.Property(s => s.Value).IsRequired();

        // Bez tokenu współbieżności `xmin` — konwencja z ErpDbContext dokłada go tylko korzeniom
        // agregatów, a tutaj byłby wręcz szkodliwy: współbieżność rozstrzyga atomowy
        // `INSERT … ON CONFLICT DO UPDATE` po stronie Postgresa, nie kontrola optymistyczna.
    }
}
