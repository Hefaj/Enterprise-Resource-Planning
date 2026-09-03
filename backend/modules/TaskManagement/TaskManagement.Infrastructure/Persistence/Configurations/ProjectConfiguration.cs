using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.FieldSchemes;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Projects;

namespace TaskManagement.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie agregatu <see cref="Project"/> razem z członkami.</summary>
public sealed class ProjectConfiguration : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("project");
        builder.HasKey(p => p.Uuid);

        builder.Property(p => p.Code).HasMaxLength(16).IsRequired();
        builder.Property(p => p.Name).HasMaxLength(256).IsRequired();
        builder.Property(p => p.Kind).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(p => p.WorkflowSchemeUuid).IsRequired();

        // Schemat typów zgłoszeń — wymagany tak samo jak schemat stanów (TYP-001): projekt bez
        // typów nie da założyć żadnego zgłoszenia.
        builder.Property(p => p.IssueTypeSchemeUuid).IsRequired();

        builder.Property(p => p.IsPublic).IsRequired();

        // Schemat pól jest opcjonalny — projekt bez pól własnych to stan normalny.
        // `Restrict`, nie kaskada: skasowanie schematu nie może po cichu odpiąć pól projektom,
        // które z nich korzystają.
        builder.Property(p => p.FieldSchemeUuid);

        builder.HasOne<FieldScheme>()
            .WithMany()
            .HasForeignKey(p => p.FieldSchemeUuid)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<IssueTypeScheme>()
            .WithMany()
            .HasForeignKey(p => p.IssueTypeSchemeUuid)
            .OnDelete(DeleteBehavior.Restrict);

        // Polityka SLA — pięć kolumn opcjonalnych naraz, nie osobna tabela 1:1: to jedna
        // decyzja konfiguracyjna projektu, nie kolekcja, więc dodatkowy JOIN nie kupuje niczego
        // (PRJ-006, faza 5).
        builder.Property(p => p.SlaResponseMinutes);
        builder.Property(p => p.SlaResolutionMinutes);
        builder.Property(p => p.SlaWorkingDays).HasConversion<string>().HasMaxLength(64);
        builder.Property(p => p.SlaWorkStartTime);
        builder.Property(p => p.SlaWorkEndTime);

        builder.HasIndex(p => p.Code).IsUnique();

        // PRJ-004 — domyślnie `false`; ukrycie z list domyślnych filtruje po tym samym indeksie.
        builder.Property(p => p.IsArchived).IsRequired();
        builder.HasIndex(p => p.IsArchived);

        // VIEW-002 — referencja miękka, celowo BEZ klucza obcego do `saved_view`: usunięcie
        // widoku wskazanego jako domyślny (VIEW-001 — każdy właściciel usuwa swój widok w
        // dowolnej chwili) nie musi być zsynchronizowane w tej samej transakcji. Front pomija
        // auto-zastosowanie widoku, którego nie znajdzie wśród wczytanych — patrz komentarz
        // przy `Project.DefaultSavedViewUuid`.
        builder.Property(p => p.DefaultSavedViewUuid);

        builder.HasMany(p => p.Members)
            .WithOne()
            .HasForeignKey(m => m.ProjectUuid)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(p => p.Members).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

/// <summary>Mapowanie członkostwa. Unikalność po parze (projekt, użytkownik) jest w bazie,
/// nie w kodzie — dwa równoległe nadania tej samej osoby to zwykły wyścig, a nie rzadkość.</summary>
public sealed class ProjectMemberConfiguration : IEntityTypeConfiguration<ProjectMember>
{
    public void Configure(EntityTypeBuilder<ProjectMember> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("project_member");
        builder.HasKey(m => m.Uuid);

        // Klucz nadaje aplikacja (Entity.NewUuid — UUID v7), baza nigdy go nie generuje. Bez
        // tej deklaracji Project.AddMember() na już wczytanym (nie świeżo utworzonym) projekcie
        // dopisuje nowego członka do śledzonej kolekcji Members bez jawnego Add() na DbContext —
        // EF, widząc niepusty klucz przy pierwszym odkryciu encji przez fixup nawigacji, zakłada
        // istniejący wiersz i planuje UPDATE zamiast INSERT-a, co trafia w 0 wierszy i wybucha
        // jako DbUpdateConcurrencyException. Ten sam mechanizm i fix — patrz IssueWatcherConfiguration
        // i komentarz przy Catalog.Domain.Products.ProductLinks.
        builder.Property(m => m.Uuid).ValueGeneratedNever();

        builder.Property(m => m.ProjectUuid).IsRequired();
        builder.Property(m => m.UserUuid).IsRequired();
        builder.Property(m => m.Role).HasConversion<string>().HasMaxLength(16).IsRequired();

        builder.HasIndex(m => new { m.ProjectUuid, m.UserUuid }).IsUnique();

        // Predykat widoczności listy zgłoszeń startuje od „w których projektach jestem” —
        // bez tego indeksu każde wyszukiwanie zaczyna się od skanu członkostw.
        builder.HasIndex(m => m.UserUuid);
    }
}

/// <summary>
/// Mapowanie licznika numeracji. Klucz główny to <c>project_uuid</c>, nie sztuczny <c>uuid</c> —
/// licznik jest jednym wierszem na projekt i to po nim celuje <c>UPDATE … RETURNING</c>.
/// </summary>
public sealed class ProjectKeyCounterConfiguration : IEntityTypeConfiguration<ProjectKeyCounter>
{
    public void Configure(EntityTypeBuilder<ProjectKeyCounter> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("project_key_counter");
        builder.HasKey(c => c.ProjectUuid);

        builder.Property(c => c.Prefix).HasMaxLength(16).IsRequired();
        builder.Property(c => c.NextNumber).IsRequired();

        builder.HasOne<Project>()
            .WithOne()
            .HasForeignKey<ProjectKeyCounter>(c => c.ProjectUuid)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
