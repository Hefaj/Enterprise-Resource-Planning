using TaskManagement.Domain.FieldSchemes;

namespace TaskManagement.Application.FieldSchemes;

/// <summary>Schemat pól w widoku odczytu — do ekranu konfiguracji projektu.</summary>
public sealed record FieldSchemeDto(
    Guid Uuid,
    string Name,
    bool IsSystem,
    List<FieldDefinitionDto> Fields);

/// <summary>Definicja pola w widoku odczytu.</summary>
public sealed record FieldDefinitionDto(
    Guid Uuid,
    string Code,
    string NameKey,
    CustomFieldDataType DataType,
    FieldSlot Slot,
    int OrderNo,
    bool IsRequired,
    List<string> Options);

/// <summary>
/// Profil pól projektu — <b>jedno źródło prawdy dla kolumn tabeli, filtrów i whitelisty
/// sortowania</b> (<c>docs/backend/task-management.md</c> §6).
///
/// <para>Front buduje z tego konfigurację tabeli, a backend czyta z tego samego profilu przy
/// tłumaczeniu nazwy pola na slot w <c>ORDER BY</c> — dzięki temu nie da się ich rozjechać.
/// Projekt bez schematu pól zwraca pustą listę, a nie 404: „ten projekt nie ma pól własnych"
/// jest odpowiedzią, nie błędem.</para>
/// </summary>
public sealed record ProjectFieldProfileDto(
    Guid ProjectUuid,
    Guid? FieldSchemeUuid,
    List<ProjectFieldDto> Fields);

/// <summary>
/// Pole w profilu projektu.
///
/// <para><see cref="IsSortable"/> i <see cref="IsFilterable"/> są tu <b>jednym i tym samym</b>
/// pytaniem („czy pole zajmuje slot"), ale jadą jako dwa pola kontraktu: rozdzielenie ich
/// później — gdy dojdzie filtrowanie po jsonb bez sortowania — nie będzie już wtedy zmianą
/// łamiącą klienta.</para>
/// </summary>
public sealed record ProjectFieldDto(
    string Code,
    string NameKey,
    CustomFieldDataType DataType,
    bool IsSortable,
    bool IsFilterable,
    bool IsRequired,
    int OrderNo,
    List<string> Options);

/// <summary>Żądanie profilu pól projektu.</summary>
public sealed class GetProjectFieldProfileRequest
{
    public Guid ProjectUuid { get; set; }
}

/// <summary>Żądanie listy schematów pól.</summary>
public sealed class SearchFieldSchemeRequest
{
    /// <summary>Fragment nazwy. Pusty zwraca wszystkie.</summary>
    public string? Text { get; set; }
}

/// <summary>Odczyty schematów pól i profilu projektu.</summary>
public interface IFieldSchemeQueries
{
    Task<List<FieldSchemeDto>> SearchAsync(SearchFieldSchemeRequest request, CancellationToken cancellationToken);

    /// <summary>
    /// Profil pól projektu. Zwraca pustą listę pól dla projektu bez schematu — patrz
    /// <see cref="ProjectFieldProfileDto"/>.
    /// </summary>
    Task<ProjectFieldProfileDto> GetProjectProfileAsync(Guid projectUuid, CancellationToken cancellationToken);

    /// <summary>
    /// Mapa „kod pola → slot" dla projektu, do whitelisty sortowania i filtrów po stronie
    /// zapytania o zgłoszenia. Osobno od profilu, bo zapytanie o listę nie potrzebuje kluczy
    /// tłumaczeń ani słowników wartości, a woła się to przy każdym stronicowaniu.
    /// </summary>
    Task<IReadOnlyDictionary<string, FieldSlot>> GetProjectSlotMapAsync(
        Guid projectUuid,
        CancellationToken cancellationToken);
}
