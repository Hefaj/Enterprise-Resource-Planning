using Microsoft.EntityFrameworkCore;
using Shouldly;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Projects;
using TaskManagement.Domain.Tags;
using TaskManagement.Domain.Workflow;
using TaskManagement.Infrastructure.Repositories;
using Xunit;

namespace Erp.IntegrationTests;

/// <summary>
/// TAG-003 — scalanie tagów. Testuje <see cref="IssueTagWriter.RepointAsync"/> bezpośrednio,
/// z pominięciem <c>TagExecMergeCommandHandler</c>: klasy komend dziedziczące po FastEndpoints
/// <c>CommandHandler&lt;,&gt;</c> wymagają uruchomionego hosta FastEndpoints (statyczny
/// <c>ServiceResolver</c>), którego nic w tym repozytorium jeszcze nie stawia dla testów —
/// żaden istniejący handler w żadnym module nie jest dziś testowany w izolacji z tego samego
/// powodu. <see cref="IssueTagWriter"/> jest zwykłą klasą infrastruktury, więc test dowodzi
/// dokładnie tego, co ma znaczenie: przepięcie <c>issue_tag</c> z dedupem, bez EF change trackera.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class TaskManagementTagMergeTests
{
    private readonly PostgresFixture _postgres;

    public TaskManagementTagMergeTests(PostgresFixture postgres) => _postgres = postgres;

    [Fact]
    public async Task Scalenie_przenosi_tag_i_usuwa_duplikaty()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var database = await TaskManagementDatabase.CreateAsync(_postgres, ct);

        var scheme = WorkflowScheme.CreateWithUuid(Guid.CreateVersion7(), "Domyślny", true);
        var todoUuid = Guid.CreateVersion7();
        scheme.AddState(todoUuid, "todo", "state.todo", WorkflowStateCategory.Todo, 0);

        var typeScheme = IssueTypeScheme.CreateWithUuid(Guid.CreateVersion7(), "Domyślny", true);
        var typeUuid = Guid.CreateVersion7();
        typeScheme.AddType(typeUuid, "task", "Zadanie", null, "list", IssueTypeCategory.Standard, 0);

        var project = Project.CreateWithUuid(
            Guid.CreateVersion7(), "MRG", "Merge", ProjectKind.Delivery, scheme.Uuid, typeScheme.Uuid, true);

        var now = DateTimeOffset.UtcNow;
        var reporter = Guid.CreateVersion7();

        // Trzy zgłoszenia: jedno TYLKO z tagiem źródłowym, jedno TYLKO z docelowym (kontrola —
        // scalenie nie może go ruszyć), jedno z OBOMA naraz (przypadek dedupu — po scaleniu ma
        // zostać dokładnie jeden wiersz, nie dwa identyczne).
        var onlySource = Issue.CreateWithUuid(Guid.CreateVersion7(), project.Uuid, "MRG-1", "Tylko źródłowy", scheme, typeScheme.Types[0], reporter, now);
        var onlyTarget = Issue.CreateWithUuid(Guid.CreateVersion7(), project.Uuid, "MRG-2", "Tylko docelowy", scheme, typeScheme.Types[0], reporter, now);
        var both = Issue.CreateWithUuid(Guid.CreateVersion7(), project.Uuid, "MRG-3", "Oba naraz", scheme, typeScheme.Types[0], reporter, now);

        var source = Tag.CreateWithUuid(Guid.CreateVersion7(), project.Uuid, "źródłowy", null);
        var target = Tag.CreateWithUuid(Guid.CreateVersion7(), project.Uuid, "docelowy", null);

        onlySource.AddTag(source.Uuid, now);
        onlyTarget.AddTag(target.Uuid, now);
        both.AddTag(source.Uuid, now);
        both.AddTag(target.Uuid, now);

        await using (var seedContext = database.NewContext())
        {
            seedContext.WorkflowSchemes.Add(scheme);
            seedContext.IssueTypeSchemes.Add(typeScheme);
            seedContext.Projects.Add(project);
            seedContext.Tags.AddRange(source, target);
            seedContext.Issues.AddRange(onlySource, onlyTarget, both);
            await seedContext.SaveChangesAsync(ct);
        }

        await using (var mergeContext = database.NewContext())
        {
            var writer = new IssueTagWriter(mergeContext);
            await writer.RepointAsync(source.Uuid, target.Uuid, ct);

            var sourceTag = await mergeContext.Tags.FindAsync([source.Uuid], ct);
            mergeContext.Tags.Remove(sourceTag!);
            await mergeContext.SaveChangesAsync(ct);
        }

        await using var verifyContext = database.NewContext();

        (await verifyContext.IssueTags.AsNoTracking().Where(t => t.IssueUuid == onlySource.Uuid).ToListAsync(ct))
            .Select(t => t.TagUuid).ShouldBe([target.Uuid]);

        (await verifyContext.IssueTags.AsNoTracking().Where(t => t.IssueUuid == onlyTarget.Uuid).ToListAsync(ct))
            .Select(t => t.TagUuid).ShouldBe([target.Uuid]);

        // Dedup: zgłoszenie miało już oba tagi — po scaleniu dokładnie JEDEN wiersz wskazujący
        // na tag docelowy, nie dwa identyczne (co złamałoby unikalny indeks (issue_uuid, tag_uuid)).
        (await verifyContext.IssueTags.AsNoTracking().Where(t => t.IssueUuid == both.Uuid).ToListAsync(ct))
            .Select(t => t.TagUuid).ShouldBe([target.Uuid]);

        (await verifyContext.Tags.AsNoTracking().AnyAsync(t => t.Uuid == source.Uuid, ct)).ShouldBeFalse();
        (await verifyContext.Tags.AsNoTracking().AnyAsync(t => t.Uuid == target.Uuid, ct)).ShouldBeTrue();
    }
}
