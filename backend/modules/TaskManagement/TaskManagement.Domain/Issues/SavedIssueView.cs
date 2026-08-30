using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Issues;

/// <summary>Osobisty zapis parametrów listy zgłoszeń. Filtr i układ są kontraktem UI, nie modelem domenowym zgłoszenia.</summary>
public sealed class SavedIssueView : AggregateRoot
{
    private SavedIssueView() { }

    private SavedIssueView(Guid uuid, Guid ownerUuid, string name, string filterJson, string columnsJson, bool isDefault, DateTimeOffset now)
        : base(uuid)
    {
        OwnerUuid = ownerUuid;
        Name = name;
        FilterJson = filterJson;
        ColumnsJson = columnsJson;
        IsDefault = isDefault;
        CreatedAt = now;
        UpdatedAt = now;
    }

    public Guid OwnerUuid { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string FilterJson { get; private set; } = "{}";
    public string ColumnsJson { get; private set; } = "[]";
    public bool IsDefault { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public static SavedIssueView Create(Guid ownerUuid, string name, string filterJson, string columnsJson, bool isDefault, DateTimeOffset now)
        => new(NewUuid(), ownerUuid, ValidateName(name), ValidateJson(filterJson), ValidateJson(columnsJson), isDefault, now);

    public void Update(string name, string filterJson, string columnsJson, bool isDefault, DateTimeOffset now)
    {
        Name = ValidateName(name);
        FilterJson = ValidateJson(filterJson);
        ColumnsJson = ValidateJson(columnsJson);
        IsDefault = isDefault;
        UpdatedAt = now;
    }

    private static string ValidateName(string name)
        => string.IsNullOrWhiteSpace(name)
            ? throw new DomainException("taskmgmt.saved_view_name_empty", "Nazwa widoku nie może być pusta.")
            : name.Trim();

    private static string ValidateJson(string value)
        => string.IsNullOrWhiteSpace(value)
            ? throw new DomainException("taskmgmt.saved_view_payload_empty", "Konfiguracja widoku nie może być pusta.")
            : value;
}
