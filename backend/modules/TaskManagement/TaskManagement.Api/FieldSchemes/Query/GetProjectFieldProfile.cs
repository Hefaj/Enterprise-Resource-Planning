using FastEndpoints;
using TaskManagement.Application.FieldSchemes;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.FieldSchemes.Query;

/// <summary>
/// Profil pól projektu — kolumny tabeli, filtry i whitelist sortowania budują się z tej jednej
/// odpowiedzi (<c>docs/backend/task-management.md</c> §6).
///
/// <para>Uprawnieniem jest <c>issue.read</c>, nie <c>scheme.manage</c>: profil jest potrzebny
/// każdemu, kto ogląda listę zgłoszeń projektu, a nie tylko temu, kto go konfiguruje.</para>
/// </summary>
public sealed class GetProjectFieldProfileEndpoint : Endpoint<GetProjectFieldProfileRequest, ProjectFieldProfileDto>
{
    private readonly IFieldSchemeQueries _queries;

    public GetProjectFieldProfileEndpoint(IFieldSchemeQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getProjectFieldProfile");
        Group<FieldSchemeGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(GetProjectFieldProfileRequest req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        var profile = await _queries.GetProjectProfileAsync(req.ProjectUuid, ct);
        await Send.OkAsync(profile, ct);
    }
}
