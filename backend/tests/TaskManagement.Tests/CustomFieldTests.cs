using Erp.BuildingBlocks.Domain;
using Shouldly;
using TaskManagement.Domain.FieldSchemes;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Workflow;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>
/// Pola niestandardowe na slotach (<c>docs/backend/task-management.md</c> §6).
///
/// <para>Testujemy agregat, bo to on trzyma dwa niezmienniki, których pomyłka nie objawia się
/// wyjątkiem, tylko cichym przekłamaniem danych: <b>slot pasuje typem</b> i <b>slot jest zajęty
/// przez najwyżej jedno pole</b>. Rozjazd któregokolwiek z nich znaczy, że sortowanie po
/// „Budżecie" pokazuje liczbę godzin.</para>
/// </summary>
public class CustomFieldTests
{
    private static readonly Guid ProjectUuid = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Reporter = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid Reviewer = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly DateTimeOffset Now = new(2026, 8, 27, 12, 0, 0, TimeSpan.Zero);

    private static FieldScheme Scheme()
    {
        var scheme = FieldScheme.CreateWithUuid(Guid.CreateVersion7(), "Pola zespołu", isSystem: false);

        scheme.AddField(Guid.CreateVersion7(), "storyPoints", "Punkty historyjki", "k.points", CustomFieldDataType.Number, FieldSlot.Num1, 0);
        scheme.AddField(
            Guid.CreateVersion7(), "component", "Komponent", "k.component", CustomFieldDataType.Select, FieldSlot.Text1, 1,
            options: ["Backend", "Frontend"]);
        scheme.AddField(Guid.CreateVersion7(), "startedOn", "Data rozpoczęcia", "k.startedOn", CustomFieldDataType.Date, FieldSlot.Date1, 2);
        scheme.AddField(Guid.CreateVersion7(), "reviewer", "Recenzent", "k.reviewer", CustomFieldDataType.User, FieldSlot.User1, 3);
        scheme.AddField(Guid.CreateVersion7(), "notes", "Notatki", "k.notes", CustomFieldDataType.Text, FieldSlot.None, 4);

        return scheme;
    }

    private static Issue Issue()
    {
        var workflow = WorkflowSchemeDefaults.Build();
        var issueType = IssueTypeSchemeDefaults.Build().DefaultType();

        return Domain.Issues.Issue.CreateWithUuid(
            Guid.CreateVersion7(), ProjectUuid, "DEV-1", "Tytuł", workflow, issueType, Reporter, Now);
    }

    [Fact]
    public void Slot_nie_przyjmuje_wartosci_innego_typu()
        => Should.Throw<DomainException>(() => Scheme().AddField(
                Guid.CreateVersion7(), "budget", "Budżet", "k.budget", CustomFieldDataType.Number, FieldSlot.Text3, 9))
            .ErrorCode.ShouldBe("taskmgmt.field_slot_type_mismatch");

    [Fact]
    public void Slot_zajety_przez_inne_pole_jest_odrzucany()
        => Should.Throw<DomainException>(() => Scheme().AddField(
                Guid.CreateVersion7(), "estimate", "Szacunek", "k.estimate", CustomFieldDataType.Number, FieldSlot.Num1, 9))
            .ErrorCode.ShouldBe("taskmgmt.field_slot_taken");

    /// <summary>Brak slotu to nie jest brak decyzji — pole, po którym nikt nie sortuje, nie
    /// zajmuje zasobu rzadkiego. Dwa takie pola obok siebie muszą być dozwolone.</summary>
    [Fact]
    public void Pola_bez_slotu_moga_wspolistniec()
    {
        var scheme = Scheme();

        scheme.AddField(Guid.CreateVersion7(), "context", "Kontekst", "k.context", CustomFieldDataType.Text, FieldSlot.None, 9);

        scheme.Fields.Count(f => f.Slot == FieldSlot.None).ShouldBe(2);
    }

    [Fact]
    public void Wartosci_trafiaja_do_swoich_slotow_i_do_custom_fields()
    {
        var issue = Issue();

        issue.SetCustomFields(
            Scheme(),
            new Dictionary<string, string?>
            {
                ["storyPoints"] = "8",
                ["component"] = "Backend",
                ["startedOn"] = "2026-08-01T00:00:00Z",
                ["reviewer"] = Reviewer.ToString(),
                ["notes"] = "bez slotu",
            },
            Now);

        issue.Num1.ShouldBe(8m);
        issue.Text1.ShouldBe("Backend");
        issue.Date1.ShouldBe(new DateTimeOffset(2026, 8, 1, 0, 0, 0, TimeSpan.Zero));
        issue.User1.ShouldBe(Reviewer);

        // Pole bez slotu nie ma gdzie się zdublować — żyje wyłącznie w `custom_fields`.
        issue.CustomFields["notes"].ShouldBe("bez slotu");
        issue.Text2.ShouldBeNull();
    }

    /// <summary>Człon w liczbie mnogiej znaczy „to, co przyszło, jest tym, co zostaje” —
    /// pole pominięte znika razem ze swoim slotem, bez osobnej komendy czyszczącej.</summary>
    [Fact]
    public void Pole_pominiete_w_zadaniu_jest_czyszczone_razem_ze_slotem()
    {
        var scheme = Scheme();
        var issue = Issue();

        issue.SetCustomFields(scheme, new Dictionary<string, string?> { ["storyPoints"] = "8" }, Now);
        issue.SetCustomFields(scheme, new Dictionary<string, string?> { ["component"] = "Frontend" }, Now);

        issue.Num1.ShouldBeNull();
        issue.CustomFields.ShouldNotContainKey("storyPoints");
        issue.Text1.ShouldBe("Frontend");
    }

    /// <summary>
    /// Reguła „metoda agregatu waliduje PRZED zmianą stanu”, na której stoi częściowy sukces
    /// operacji masowych: jedno błędne pole nie może zostawić zgłoszenia z połową zapisanych
    /// wartości.
    /// </summary>
    [Fact]
    public void Bledna_wartosc_nie_zostawia_zgloszenia_w_polowie_zmienionego()
    {
        var scheme = Scheme();
        var issue = Issue();

        issue.SetCustomFields(scheme, new Dictionary<string, string?> { ["storyPoints"] = "3" }, Now);

        Should.Throw<DomainException>(() => issue.SetCustomFields(
            scheme,
            new Dictionary<string, string?> { ["component"] = "Backend", ["storyPoints"] = "osiem" },
            Now)).ErrorCode.ShouldBe("taskmgmt.field_value_not_a_number");

        issue.Num1.ShouldBe(3m);
        issue.Text1.ShouldBeNull();
    }

    [Fact]
    public void Wartosc_spoza_slownika_pola_wyboru_jest_odrzucana()
        => Should.Throw<DomainException>(() => Issue().SetCustomFields(
                Scheme(),
                new Dictionary<string, string?> { ["component"] = "Marketing" },
                Now))
            .ErrorCode.ShouldBe("taskmgmt.field_value_not_in_options");

    [Fact]
    public void Pole_spoza_schematu_jest_odrzucane()
        => Should.Throw<DomainException>(() => Issue().SetCustomFields(
                Scheme(),
                new Dictionary<string, string?> { ["budget"] = "100" },
                Now))
            .ErrorCode.ShouldBe("taskmgmt.field_unknown");

    /// <summary>Postać kanoniczna jest niezależna od kultury — liczba z kropką, data w ISO-8601
    /// UTC. Bez tego ta sama wartość zapisana na dwóch maszynach znaczy co innego.</summary>
    [Fact]
    public void Wartosci_zapisuja_sie_w_postaci_kanonicznej()
    {
        var issue = Issue();

        issue.SetCustomFields(
            Scheme(),
            new Dictionary<string, string?>
            {
                ["storyPoints"] = "8.5",
                ["startedOn"] = "2026-08-01T10:30:00+02:00",
            },
            Now);

        issue.CustomFields["storyPoints"].ShouldBe("8.5");
        issue.CustomFields["startedOn"].ShouldStartWith("2026-08-01T08:30:00");
    }
}
