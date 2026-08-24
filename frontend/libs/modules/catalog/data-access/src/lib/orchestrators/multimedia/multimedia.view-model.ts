import { MultimediaDto } from '../../api-client';

/**
 * ViewModel zasobu multimedialnego.
 *
 * Dziś jest to DTO jeden do jednego — zasób nie ma pól wymagających rozwiązania po uuid,
 * w odróżnieniu od produktu (kategorie, model, gwarancje). Alias, a nie puste `interface
 * extends`: to drugie znaczy dokładnie to samo, a lint słusznie każe je zwinąć.
 *
 * Nazwa zostaje, bo tego typu używają komponenty — gdy dojdzie pole wyliczane
 * (np. adres miniaturki), rozwinie się z powrotem w pełny interfejs.
 */
export type MultimediaVM = MultimediaDto;
