import { SprintDto } from '../../api-client';

/** Sprint w widoku — bez wzbogacenia, `SprintDto` niesie już wszystko potrzebne (nagłówek
 * planowania, żadnej relacji do rozwiązania). */
export type SprintVM = SprintDto;
