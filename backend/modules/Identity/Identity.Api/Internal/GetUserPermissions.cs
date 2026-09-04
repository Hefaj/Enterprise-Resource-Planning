using FastEndpoints;
using Identity.Application.Users;
using Microsoft.AspNetCore.Http;
using Microsoft.OpenApi;

namespace Identity.Internal;

/// <summary>
/// Konsumowane przez inne mikroserwisy (Catalog, Sales, Notification) do budowy cache'u
/// uprawnień — patrz <c>docs/architecture/security.md</c> §4 (<c>IPermissionProvider</c>,
/// Faza 3). Nazwa zaczyna się od <c>/internal</c> celowo: to jest wywołanie serwis-do-serwisu,
/// nie coś, co front miałby kiedykolwiek wołać bezpośrednio (poza jednym świadomym wyjątkiem —
/// patrz komentarz przy <c>UserOrchestrator.getEffectivePermissions</c> we froncie).
///
/// <para><b>Znany dług, świadomie odłożony do Fazy 3.</b> Dziś ten endpoint wymaga wyłącznie
/// ważnego tokenu JWT (jak każdy inny) — DOWOLNY zalogowany użytkownik może dziś odpytać
/// o uprawnienia DOWOLNEGO innego użytkownika, podmieniając <c>Id</c> w ścieżce. Docelowo
/// potrzebuje osobnej polityki autoryzacji ograniczonej do kont serwisowych (client credentials
/// z Keycloaka albo sieciowa izolacja) — nie do wystawienia poza siecią wewnętrzną bez tego.</para>
///
/// <para><b><c>EndpointWithoutRequest</c> + jawny <c>AddOpenApiOperationTransformer</c> —
/// celowo, nie kosmetyka.</b> Natywny generator OpenAPI w .NET (<c>Microsoft.AspNetCore.OpenApi</c>,
/// źródło dla NSwag — patrz komentarz przy <c>ErpApiExtensions.UseErpApi</c>) nie rozumie
/// bindowania FastEndpoints: dopóki `Id` żyło jako właściwość osobnego request DTO
/// (<c>Endpoint&lt;TRequest,TResponse&gt;</c>), całe DTO lądowało w dokumencie jako
/// <c>requestBody</c> mimo szablonu trasy z <c>{Id}</c> — NSwag generował klienta z dosłownym,
/// niepodstawionym <c>{Id}</c> w URL-u (żądanie zawsze kończyło się błędem sieciowym, status 0).
/// Usunięcie DTO samo w sobie NIE wystarcza — bez konkurującego "body" natywny generator po
/// prostu nie widzi żadnego parametru (ani route, ani body), bo nie skanuje szablonu trasy pod
/// kątem tokenów niepowiązanych z żadną właściwością. Jedyny sposób, żeby FastEndpoints/.NET
/// poprawnie udokumentował parametr trasy dla GET bez DTO, to ręczne dopisanie go przez
/// <c>AddOpenApiOperationTransformer</c> (następca przestarzałego <c>WithOpenApi</c>) w
/// <c>Configure()</c> — jedyny endpoint w repo łączący trasę z parametrem i GET, stąd wcześniej
/// nieujawniony wzorzec.</para>
/// </summary>
public sealed class GetUserPermissionsEndpoint : EndpointWithoutRequest<List<string>>
{
    private readonly IUserAccountQueries _queries;

    public GetUserPermissionsEndpoint(IUserAccountQueries queries) => _queries = queries;

    public override void Configure()
    {
        Get("/internal/users/{Id}/permissions");
        Options(b => b.AddOpenApiOperationTransformer((op, _, _) =>
        {
            op.Parameters ??= [];
            op.Parameters.Add(new OpenApiParameter
            {
                Name = "Id",
                In = ParameterLocation.Path,
                Required = true,
                Schema = new OpenApiSchema { Type = JsonSchemaType.String, Format = "uuid" },
            });
            return Task.CompletedTask;
        }));
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var id = Route<Guid>("Id");
        var codes = await _queries.GetEffectivePermissionCodesAsync(id, ct);
        await Send.OkAsync(codes.ToList(), ct);
    }
}
