import { ProjectDto } from '../../api-client';

/**
 * Projekt nie wymaga żadnego wzbogacenia: `ProjectDto` niesie już członków i licznik otwartych
 * zgłoszeń, bo obie te rzeczy backend policzył w jednej projekcji. Alias typu, nie pusty
 * interfejs — patrz `docs/guides/frontend/orchestrators.md` §2.
 */
export type ProjectVM = ProjectDto;
