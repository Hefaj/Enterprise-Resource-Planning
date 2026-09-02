using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.SavedViews;

/// <summary>
/// Zapisany widok listy zgłoszeń (VIEW-001) — nazwany zestaw filtra, sortowania, kolumn
/// i trybu prezentacji. Agregat <b>własny</b>, nie podrzędny zgłoszenia ani projektu: żyje
/// niezależnie od tego, czy zgłoszenia, które kiedyś pasowały do filtra, w ogóle istnieją.
///
/// <para><see cref="OwnerUserUuid"/> to zawsze twórca — widoku nie da się „przekazać” innej
/// osobie, tylko skopiować (<c>SavedViewCreateCopyCommand</c>, VIEW-001 AC1). <see cref="ProjectUuid"/>
/// <c>null</c> znaczy widok prywatny, widoczny tylko właścicielowi; ustawiony — widok
/// udostępniony całemu projektowi, dla innych **tylko do odczytu** (VIEW-001 AC1).</para>
///
/// <para><see cref="FilterJson"/>/<see cref="SortJson"/>/<see cref="Columns"/> to nieprzejrzysty
/// dla backendu ładunek — moduł świadomie NIE waliduje go względem aktualnego profilu pól
/// projektu przy zapisie (VIEW-001 AC2, plan §B). Widok może „wyprzedzać” albo „spóźniać się”
/// za polami: pole niestandardowe usunięte po zapisaniu widoku nie unieważnia go, tylko front
/// przy otwarciu pomija nieistniejące kody i pokazuje o tym komunikat.</para>
/// </summary>
public sealed class SavedView : AggregateRoot
{
    private readonly List<string> _columns = [];

    /// <summary>Konstruktor dla EF Core.</summary>
    private SavedView()
    {
    }

    private SavedView(
        Guid uuid,
        Guid ownerUserUuid,
        Guid? projectUuid,
        string name,
        string filterJson,
        string? sortJson,
        IEnumerable<string> columns,
        SavedViewMode mode)
        : base(uuid)
    {
        OwnerUserUuid = ownerUserUuid;
        ProjectUuid = projectUuid;
        Name = name;
        FilterJson = filterJson;
        SortJson = sortJson;
        _columns = columns.ToList();
        Mode = mode;
    }

    public Guid OwnerUserUuid { get; private set; }

    /// <summary><c>null</c> = widok prywatny właściciela; ustawiony = udostępniony temu
    /// projektowi (tylko do odczytu dla innych, VIEW-001 AC1).</summary>
    public Guid? ProjectUuid { get; private set; }

    public string Name { get; private set; } = string.Empty;

    /// <summary>Filtr listy zgłoszeń, serializowany po stronie klienta. Opaque dla backendu —
    /// patrz uzasadnienie przy klasie.</summary>
    public string FilterJson { get; private set; } = string.Empty;

    public string? SortJson { get; private set; }

    /// <summary>Kody kolumn widocznych na liście, w kolejności wyświetlania. Może wskazywać
    /// kod pola, które już nie istnieje — to front filtruje przy otwarciu (VIEW-001 AC2).</summary>
    public IReadOnlyList<string> Columns => _columns.AsReadOnly();

    public SavedViewMode Mode { get; private set; } = SavedViewMode.List;

    public static SavedView CreateWithUuid(
        Guid uuid,
        Guid ownerUserUuid,
        Guid? projectUuid,
        string name,
        string? filterJson,
        string? sortJson,
        IEnumerable<string>? columns,
        SavedViewMode mode)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("taskmgmt.saved_view_name_empty", "Nazwa widoku nie może być pusta.");
        }

        if (ownerUserUuid == Guid.Empty)
        {
            throw new DomainException(
                "taskmgmt.saved_view_owner_missing",
                "Widok musi mieć właściciela — zalogowanego użytkownika.");
        }

        return new SavedView(
            uuid,
            ownerUserUuid,
            projectUuid == Guid.Empty ? null : projectUuid,
            name.Trim(),
            filterJson?.Trim() ?? string.Empty,
            string.IsNullOrWhiteSpace(sortJson) ? null : sortJson.Trim(),
            (columns ?? []).Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c.Trim()),
            mode);
    }

    /// <summary>Nadpisuje treść widoku — nazwę, filtr, sortowanie, kolumny, tryb i udostępnienie
    /// projektowi. Właściciel się nie zmienia (patrz uzasadnienie przy klasie); kto wolno wywołać
    /// tę metodę pilnuje handler komendy, nie agregat (własność weryfikowana po
    /// <see cref="OwnerUserUuid"/>).</summary>
    public void Set(
        Guid? projectUuid,
        string name,
        string? filterJson,
        string? sortJson,
        IEnumerable<string>? columns,
        SavedViewMode mode)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("taskmgmt.saved_view_name_empty", "Nazwa widoku nie może być pusta.");
        }

        ProjectUuid = projectUuid == Guid.Empty ? null : projectUuid;
        Name = name.Trim();
        FilterJson = filterJson?.Trim() ?? string.Empty;
        SortJson = string.IsNullOrWhiteSpace(sortJson) ? null : sortJson.Trim();
        Mode = mode;

        _columns.Clear();
        _columns.AddRange((columns ?? []).Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c.Trim()));
    }
}
