using Erp.BuildingBlocks.Domain;

namespace Sales.Domain.Customers;

/// <summary>
/// Klient — najprostszy możliwy agregat modułu Sales, celowo trywialny.
///
/// Jego jedynym zadaniem jest zweryfikować, że fundament (<c>Erp.BuildingBlocks.*</c>)
/// wypracowany na module Catalog da się użyć w NOWYM mikroserwisie bez kopiowania
/// infrastruktury: EF Core/Postgres, outbox Wolverine'a, automatyczne <c>AggregateChanged</c>
/// ze skanu ChangeTrackera, <c>BatchEndpointBase</c>/<c>BulkCommandRunner</c> dla operacji
/// masowych — wszystko to samo, zero duplikacji.
/// </summary>
public class Customer : AggregateRoot
{
    /// <summary>Konstruktor dla EF Core.</summary>
    protected Customer()
    {
    }

    private Customer(Guid uuid, string name, string email) : base(uuid)
    {
        Name = name;
        Email = email;
    }

    public string Name { get; private set; } = string.Empty;

    public string Email { get; private set; } = string.Empty;

    public static Customer Create(string name, string email)
        => new(NewUuid(), ValidateName(name), ValidateEmail(email));

    /// <summary>Odtwarza klienta o znanym identyfikatorze — wyłącznie dla seedera, który musi
    /// wygenerować powtarzalne dane między resetami bazy.</summary>
    public static Customer CreateWithUuid(Guid uuid, string name, string email)
        => new(uuid, ValidateName(name), ValidateEmail(email));

    public void SetName(string name) => Name = ValidateName(name);

    private static string ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("customer_name_empty", "Nazwa klienta nie może być pusta.");
        }

        return name.Trim();
    }

    private static string ValidateEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@', StringComparison.Ordinal))
        {
            throw new DomainException("customer_email_invalid", "Adres e-mail klienta jest nieprawidłowy.");
        }

        return email.Trim();
    }
}
