using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Issues;

/// <summary>
/// Link zewnętrzny na zgłoszeniu (API-005) — repozytorium kodu, PR, przebieg CI.
///
/// <para>Encja podrzędna <see cref="Issue"/>, wzorem <see cref="IssueTag"/>: mała, ograniczona
/// kolekcja, eagerowo doczytywana przy <c>IIssueRepository.FindAsync</c>. Świadomie
/// <b>nie</b> integracja w domenie — moduł nie wie nic o repozytoriach kodu, PR-ach ani CI,
/// niesie wyłącznie adres URL z etykietą nadaną przez człowieka
/// (<c>docs/modules/task-management/domain.md</c> tabela „Co jest poza zakresem").</para>
/// </summary>
public sealed class IssueExternalLink : Entity
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private IssueExternalLink()
    {
    }

    private IssueExternalLink(Guid uuid, string url, string label) : base(uuid)
    {
        Url = url;
        Label = label;
    }

    public Guid IssueUuid { get; private set; }

    public string Url { get; private set; } = string.Empty;

    public string Label { get; private set; } = string.Empty;

    internal static IssueExternalLink Create(Guid uuid, string url, string label)
        => new(uuid, ValidateUrl(url), ValidateLabel(label));

    private static string ValidateUrl(string url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            throw new DomainException("taskmgmt.issue_external_link_url_empty", "Link musi mieć adres.");
        }

        var trimmed = url.Trim();

        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var parsed)
            || (parsed.Scheme != Uri.UriSchemeHttp && parsed.Scheme != Uri.UriSchemeHttps))
        {
            throw new DomainException(
                "taskmgmt.issue_external_link_url_invalid",
                "Adres linku musi być pełnym adresem http(s).");
        }

        return trimmed.Length > 2048 ? trimmed[..2048] : trimmed;
    }

    private static string ValidateLabel(string label)
    {
        if (string.IsNullOrWhiteSpace(label))
        {
            throw new DomainException("taskmgmt.issue_external_link_label_empty", "Link musi mieć etykietę.");
        }

        var trimmed = label.Trim();

        return trimmed.Length > 256 ? trimmed[..256] : trimmed;
    }
}
