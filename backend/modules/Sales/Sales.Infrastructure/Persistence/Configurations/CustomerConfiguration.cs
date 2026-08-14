using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sales.Domain.Customers;

namespace Sales.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie agregatu <see cref="Customer"/>.</summary>
public sealed class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("customer");
        builder.HasKey(c => c.Uuid);

        builder.Property(c => c.Name).HasMaxLength(512).IsRequired();
        builder.Property(c => c.Email).HasMaxLength(320).IsRequired();

        builder.HasIndex(c => c.Name);
        builder.HasIndex(c => c.Email).IsUnique();
    }
}
