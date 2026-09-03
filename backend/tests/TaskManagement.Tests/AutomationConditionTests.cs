using Erp.BuildingBlocks.Domain;
using Shouldly;
using TaskManagement.Application.Automation;
using TaskManagement.Domain.Automation.Conditions;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Workflow;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>Wąski język warunku reguły (AUT-001 `if`, „ten sam co `guard`" — WF-003/DMS §4.4):
/// walidacja, ewaluacja i parser tekstowej postaci.</summary>
public class AutomationConditionTests
{
    private static readonly Guid TypeUuid = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid StateUuid = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid TagUuid = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid AssigneeUuid = Guid.Parse("55555555-5555-5555-5555-555555555555");

    private static AutomationIssueSnapshot Snapshot(IssuePriority priority = IssuePriority.Normal)
        => new(priority, TypeUuid, StateUuid, WorkflowStateCategory.Done, AssigneeUuid, [TagUuid]);

    // --- Walidacja --------------------------------------------------------

    [Fact]
    public void Nieznane_pole_jest_odrzucane()
    {
        var condition = new AutomationCondition([[new AutomationComparison("nope", AutomationComparisonOperator.Eq, "x")]]);

        Should.Throw<DomainException>(() => AutomationConditionValidator.Validate(condition))
            .ErrorCode.ShouldBe("taskmgmt.automation_condition_unknown_field");
    }

    [Fact]
    public void Operator_wiekszosci_na_polu_referencyjnym_jest_odrzucany()
    {
        var condition = new AutomationCondition(
            [[new AutomationComparison(AutomationFieldPath.State, AutomationComparisonOperator.Gt, StateUuid.ToString())]]);

        Should.Throw<DomainException>(() => AutomationConditionValidator.Validate(condition))
            .ErrorCode.ShouldBe("taskmgmt.automation_condition_operator_not_supported");
    }

    [Fact]
    public void Literal_spoza_enuma_jest_odrzucany()
    {
        var condition = new AutomationCondition(
            [[new AutomationComparison(AutomationFieldPath.Priority, AutomationComparisonOperator.Eq, "Bardzowysoki")]]);

        Should.Throw<DomainException>(() => AutomationConditionValidator.Validate(condition))
            .ErrorCode.ShouldBe("taskmgmt.automation_condition_literal_invalid");
    }

    [Fact]
    public void Pusta_lista_grup_jest_zawsze_prawdziwa()
        => AutomationCondition.Always.IsAlways.ShouldBeTrue();

    // --- Ewaluacja ----------------------------------------------------------

    [Theory]
    [InlineData(AutomationComparisonOperator.Eq, IssuePriority.High, true)]
    [InlineData(AutomationComparisonOperator.Ne, IssuePriority.High, false)]
    [InlineData(AutomationComparisonOperator.Gte, IssuePriority.High, true)]
    [InlineData(AutomationComparisonOperator.Gt, IssuePriority.High, false)]
    [InlineData(AutomationComparisonOperator.Lt, IssuePriority.High, false)]
    public void Porownanie_priorytetu(AutomationComparisonOperator op, IssuePriority literal, bool expected)
    {
        var condition = new AutomationCondition([[new AutomationComparison(AutomationFieldPath.Priority, op, literal.ToString())]]);

        AutomationConditionEvaluator.Evaluate(condition, Snapshot(IssuePriority.High)).ShouldBe(expected);
    }

    [Fact]
    public void And_wymaga_wszystkich_porownan_w_grupie()
    {
        var condition = new AutomationCondition(
        [
            [
                new AutomationComparison(AutomationFieldPath.Priority, AutomationComparisonOperator.Eq, "High"),
                new AutomationComparison(AutomationFieldPath.Tag, AutomationComparisonOperator.Ne, TagUuid.ToString()),
            ],
        ]);

        AutomationConditionEvaluator.Evaluate(condition, Snapshot(IssuePriority.High)).ShouldBeFalse();
    }

    [Fact]
    public void Or_wystarczy_jedna_grupa_prawdziwa()
    {
        var condition = new AutomationCondition(
        [
            [new AutomationComparison(AutomationFieldPath.Priority, AutomationComparisonOperator.Eq, "Critical")],
            [new AutomationComparison(AutomationFieldPath.Tag, AutomationComparisonOperator.Eq, TagUuid.ToString())],
        ]);

        AutomationConditionEvaluator.Evaluate(condition, Snapshot(IssuePriority.High)).ShouldBeTrue();
    }

    [Fact]
    public void Assignee_null_nie_pasuje_do_zadnego_literalu()
    {
        var condition = new AutomationCondition(
            [[new AutomationComparison(AutomationFieldPath.Assignee, AutomationComparisonOperator.Eq, AssigneeUuid.ToString())]]);

        var unassigned = Snapshot() with { AssigneeUuid = null };

        AutomationConditionEvaluator.Evaluate(condition, unassigned).ShouldBeFalse();
    }

    // --- Parser i równoważność z AST budowanym wprost ------------------------

    [Fact]
    public void Parser_odczytuje_pojedyncze_porownanie()
    {
        var condition = AutomationConditionParser.Parse("priority = \"High\"");

        condition.Groups.ShouldHaveSingleItem();
        condition.Groups[0].ShouldHaveSingleItem();
        condition.Groups[0][0].ShouldBe(new AutomationComparison("priority", AutomationComparisonOperator.Eq, "High"));
    }

    [Fact]
    public void Parser_odczytuje_and_or_bez_cudzyslowow()
    {
        var condition = AutomationConditionParser.Parse(
            $"priority = High and state.category = Done or tag = {TagUuid}");

        condition.Groups.Count.ShouldBe(2);
        condition.Groups[0].Count.ShouldBe(2);
        condition.Groups[1].Count.ShouldBe(1);
    }

    [Fact]
    public void Pusty_tekst_daje_warunek_zawsze_prawdziwy()
        => AutomationConditionParser.Parse("  ").IsAlways.ShouldBeTrue();

    [Fact]
    public void Nieznany_operator_niesie_pozycje_bledu()
        => Should.Throw<AutomationConditionParseException>(() => AutomationConditionParser.Parse("priority ~ High"))
            .Position.ShouldBe(9);

    /// <summary>Test równoważności AUT-001: parser tekstowej postaci i AST zbudowany wprost
    /// (jak robi to budowniczy formularza w UI) dają IDENTYCZNY wynik ewaluacji dla
    /// równoważnego zapytania.</summary>
    [Fact]
    public void Parser_i_AST_budowany_wprost_daja_ten_sam_wynik_ewaluacji()
    {
        var fromText = AutomationConditionParser.Parse(
            $"priority = High and state.category = Done or tag = {TagUuid}");

        var fromForm = new AutomationCondition(
        [
            [
                new AutomationComparison(AutomationFieldPath.Priority, AutomationComparisonOperator.Eq, "High"),
                new AutomationComparison(AutomationFieldPath.StateCategory, AutomationComparisonOperator.Eq, "Done"),
            ],
            [new AutomationComparison(AutomationFieldPath.Tag, AutomationComparisonOperator.Eq, TagUuid.ToString())],
        ]);

        foreach (var priority in Enum.GetValues<IssuePriority>())
        {
            var snapshot = Snapshot(priority);

            AutomationConditionEvaluator.Evaluate(fromText, snapshot)
                .ShouldBe(AutomationConditionEvaluator.Evaluate(fromForm, snapshot));
        }
    }

    // --- Serializacja ---------------------------------------------------------

    [Fact]
    public void Serializacja_i_deserializacja_zachowuje_tresc()
    {
        var original = new AutomationCondition(
            [[new AutomationComparison(AutomationFieldPath.Priority, AutomationComparisonOperator.Eq, "High")]]);

        var json = AutomationConditionSerializer.Serialize(original);
        var roundTripped = AutomationConditionSerializer.Deserialize(json);

        // `record` z polem `IReadOnlyList<T>` porównuje listy przez referencję, nie strukturalnie
        // — stąd porównanie spłaszczone zamiast `ShouldBe` na całym `AutomationCondition`.
        roundTripped.Groups.SelectMany(g => g).ShouldBe(original.Groups.SelectMany(g => g));
    }

    [Fact]
    public void Warunek_zawsze_prawdziwy_serializuje_sie_do_null()
        => AutomationConditionSerializer.Serialize(AutomationCondition.Always).ShouldBeNull();
}
