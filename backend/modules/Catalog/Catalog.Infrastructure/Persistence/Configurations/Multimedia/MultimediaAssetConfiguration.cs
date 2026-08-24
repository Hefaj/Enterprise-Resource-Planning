using Catalog.Domain.Multimedia;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;

namespace Catalog.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie agregatu <see cref="MultimediaAsset"/>.</summary>
public sealed class MultimediaAssetConfiguration : IEntityTypeConfiguration<MultimediaAsset>
{
    public void Configure(EntityTypeBuilder<MultimediaAsset> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("multimedia");
        builder.HasKey(m => m.Uuid);

        builder.Property(m => m.FileName).HasMaxLength(512).IsRequired();
        builder.Property(m => m.MediaType).HasMaxLength(64).IsRequired();
        builder.Property(m => m.MimeType).HasMaxLength(128).IsRequired();
        builder.Property(m => m.ThumbnailUrl).HasMaxLength(2048);
        // Nie `IsRequired`: zasób wgrany do naszego magazynu nie ma adresu zewnętrznego, wskazuje
        // go `ArtifactUuid`. Dokładnie jedno z dwóch pól jest wypełnione (patrz MultimediaAsset).
        builder.Property(m => m.OriginalUrl).HasMaxLength(2048);

        builder.HasIndex(m => m.FileName);
        builder.HasIndex(m => m.CreatedAt);

        // Po tym indeksie idzie sprzątanie osieroconych obiektów w magazynie: pytanie „czy ten
        // artefakt jest jeszcze czyjś" bez niego skanuje całą tabelę.
        builder.HasIndex(m => m.ArtifactUuid);
    }
}
