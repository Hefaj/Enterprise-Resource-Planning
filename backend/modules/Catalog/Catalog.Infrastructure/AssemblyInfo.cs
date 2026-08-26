using System.Runtime.CompilerServices;

// Testy integracyjne sięgają po `ExportRunner.ClaimNextRunAsync` i `ReclaimAbandonedRunsAsync`.
//
// Alternatywą byłoby przepisanie ich SQL-a w teście — czyli sprawdzanie kopii mechanizmu zamiast
// mechanizmu. Wyłączność przejęcia i predykat odzysku są sednem tego, co faza 1 zmieniła
// w eksportach, więc test ma dotykać dokładnie tego kodu, który pojedzie na produkcję.
[assembly: InternalsVisibleTo("Erp.IntegrationTests")]
