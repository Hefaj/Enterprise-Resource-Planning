namespace Erp.BuildingBlocks.Validation;

/// <summary>Jedno naruszenie reguły biznesowej wykryte podczas walidacji wsadowej.</summary>
/// <param name="ErrorCode">Kod w <c>snake_case</c>, tej samej rodziny co <c>DomainException.ErrorCode</c> —
/// dzięki temu odrzucenia z pre-checku i porażki z <c>BulkCommandRunner</c> lądują w tym samym
/// raporcie (<c>job_item.error_code</c>) i grupują się tym samym mechanizmem.</param>
/// <param name="ErrorMessage">Komunikat dla developera, nie dla użytkownika końcowego.</param>
public readonly record struct ValidationError(string ErrorCode, string ErrorMessage);

/// <summary>
/// Centralny zbiornik błędów przekazywany między regułami wsadowymi.
///
/// Grupuje naruszenia po identyfikatorze agregatu, więc pojedyncza walidacja potrafi
/// precyzyjnie oddzielić elementy poprawne od tych naruszających zasady biznesowe —
/// bez tego każda reguła musiałaby sama nosić i scalać własną listę odrzuceń.
///
/// Jeden element może zebrać kilka błędów (patrz tryb niezależnych reguł w
/// <see cref="ValidationChain{T}"/>) — przy zamianie na <c>job_item.error_code</c>,
/// który mieści tylko jeden kod, wygrywa pierwszy zarejestrowany.
/// </summary>
public sealed class ValidationTracker
{
    private readonly Dictionary<Guid, List<ValidationError>> _errors = [];

    /// <summary>Błędy zgrupowane po identyfikatorze agregatu, w kolejności rejestracji.</summary>
    public IReadOnlyDictionary<Guid, List<ValidationError>> Errors => _errors;

    /// <summary>Rejestruje naruszenie dla danego agregatu.</summary>
    public void AddError(Guid aggregateUuid, string errorCode, string errorMessage)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(errorCode);

        if (!_errors.TryGetValue(aggregateUuid, out var list))
        {
            list = [];
            _errors[aggregateUuid] = list;
        }

        list.Add(new ValidationError(errorCode, errorMessage));
    }

    /// <summary>Czy dany agregat zebrał już przynajmniej jedno naruszenie.</summary>
    public bool HasError(Guid aggregateUuid) => _errors.ContainsKey(aggregateUuid);
}
