import { Observable } from 'rxjs';

import { IssueAttachmentContentService } from './issue-attachment-content.service';
import { IssueAttachmentService } from './issue-attachment.service';

/**
 * Kształt portu `erp-rich-text` (`ErpRichTextImageUploadPort` w `@erp/shared/ui`) **powielony
 * lokalnie, nie zaimportowany** — `data-access` nie wolno zależeć od `type:ui`
 * (`@nx/enforce-module-boundaries`). Sygnatura strukturalna wystarczy: `feature`, jedyny
 * konsument, przypisuje wynik wprost do `ErpRichTextConfig.uploadImage`.
 */
export type IssueRichTextImageUploadPort = (file: File | Blob) => Observable<string>;

/** `AbstractControl`-owy minimum potrzebny do podmiany `src` po zakończeniu wgrywania —
 * `erp-rich-text` samo w sobie nie eksponuje więcej, a moduł nie powinien znać reszty API
 * formularza, żeby to zrobić. */
export interface IssueRichTextUploadControl {
  readonly value: string | null;
  setValue(value: string, options?: { emitEvent?: boolean }): void;
}

/**
 * Buduje port wgrywania obrazków dla `erp-rich-text`, wspólny dla opisu zgłoszenia (`ISS-005`)
 * i komentarza (`CMT-006`) — **załącznik zawsze należy do zgłoszenia, nigdy do komentarza**
 * (`IssueAttachmentCreateCommandEndpoint` przyjmuje `issueUuid`, nie `commentUuid`).
 *
 * <p>Trzy kroki, dokładnie jak w `IssueAttachmentContentService`/`IssueAttachmentService`:</p>
 * <ol>
 *   <li>zwraca natychmiast lokalny `blob:` — to jest „progres" z `ISS-005` AC2, bo `erp-rich-text`
 *       wstawia obrazek zaraz po pierwszej emisji Observable, więc dalsza praca idzie w tle;</li>
 *   <li>w tle wgrywa plik (bilet → `PUT` do magazynu → rejestracja jedną komendą) i rejestruje
 *       załącznik zgłoszenia;</li>
 *   <li>po zakończeniu podmienia lokalny `blob:` na `blob:` <b>autoryzowany</b> — ten sam,
 *       którego dostarcza {@link IssueAttachmentContentService.contentUrl} kafelkom załączników.
 *       <b>Nie</b> na goły adres kanoniczny (`/issue/attachment/content/{uuid}`): ten trafiłby
 *       wprost do `<img src>` bez nagłówka `Authorization` i rozbiłby podgląd w TEJ SAMEJ sesji
 *       edycji (przeglądarka dostałaby `401`, zanim użytkownik w ogóle kliknie „zapisz").
 *       Podmiana na adres kanoniczny jest osobnym krokiem — patrz
 *       {@link canonicalizeIssueRichTextHtml}.</li>
 * </ol>
 *
 * <p><b>Wyświetlanie w drugą stronę</b> (adres kanoniczny → `blob:` z tokenem) załatwia
 * {@link resolveIssueRichTextHtmlAsync} — komponent karty wywołuje ją przy wejściu w podgląd
 * i w tryb edycji, bo `<img src>` bez nagłówka `Authorization` dostałby 401.</p>
 *
 * @param issueUuid zgłoszenie, do którego trafi załącznik — `null`/`undefined`, dopóki
 *   zgłoszenie się nie utworzy (np. formularz tworzenia); port wtedy zwraca sam `blob:` i nie
 *   wgrywa nic, bo nie ma jeszcze do czego przypiąć załącznika.
 * @param control kontrolka, w której trzeba podmienić `src` po zakończeniu transferu.
 */
export function createIssueRichTextUploadPort(
  attachments: IssueAttachmentService,
  content: IssueAttachmentContentService,
  issueUuid: () => string | null | undefined,
  control: () => IssueRichTextUploadControl | null | undefined,
): IssueRichTextImageUploadPort {
  return (file: File | Blob) =>
    new Observable<string>((subscriber) => {
      const blobUrl = URL.createObjectURL(file);

      subscriber.next(blobUrl);
      subscriber.complete();

      const uuid = issueUuid();

      if (!uuid) {
        // Formularz bez zgłoszenia (np. krok tworzenia) — obrazek zostaje tymczasowy w tej
        // sesji; docelowe wgrywanie wymaga uuid, które dopiero powstanie po zapisie.
        return;
      }

      const asFile = file instanceof File ? file : new File([file], `paste-${Date.now()}.png`, { type: file.type });

      void attachments
        .uploadAsync(uuid, [asFile])
        .then(([attachmentUuid]) => {
          if (!attachmentUuid) {
            return;
          }

          // Zamawia ten sam autoryzowany `blob:`, który dostałby kafelek załącznika — obrazek
          // w edytorze zostaje widoczny przez CAŁĄ sesję edycji, nie tylko do końca wgrywania.
          void firstDefinedAsync(content.contentUrl(attachmentUuid)).then((authenticatedBlobUrl) => {
            if (!authenticatedBlobUrl) {
              return;
            }

            const ctrl = control();
            const current = ctrl?.value;

            if (ctrl && typeof current === 'string' && current.includes(blobUrl)) {
              ctrl.setValue(current.split(blobUrl).join(authenticatedBlobUrl), { emitEvent: false });
              URL.revokeObjectURL(blobUrl);
            }
          });
        })
        .catch((error: unknown) => {
          console.error('[createIssueRichTextUploadPort] Nie udało się wgrać obrazka.', error);
        });
    });
}

/** Adres `blob:` z {@link IssueAttachmentContentService.contentUrl}, dowolnej postaci. */
const BLOB_URL_PATTERN = /blob:[^"'\s)]+/g;

/**
 * Odwrotność podmiany zrobionej przez {@link createIssueRichTextUploadPort} — zamienia w treści
 * (opis, komentarz) każdy `blob:` rozpoznany przez {@link IssueAttachmentContentService} z powrotem
 * na adres kanoniczny załącznika, TUŻ PRZED wysłaniem do backendu. `blob:` nie przeżywa
 * przeładowania strony, więc zapisanie go wprost zepsułoby zrzut ekranu po odświeżeniu
 * (`ISS-005` AC „wyświetla się po odświeżeniu strony").
 *
 * <p>Synchroniczna — cache `IssueAttachmentContentService` już ma wszystkie `blob:` z tej sesji
 * edycji w pamięci, nie trzeba dopytywać serwera.</p>
 */
export function canonicalizeIssueRichTextHtml(
  html: string | null | undefined,
  content: IssueAttachmentContentService,
): string {
  if (!html) {
    return html ?? '';
  }

  return html.replace(BLOB_URL_PATTERN, (match) => {
    const uuid = content.uuidForBlobUrl(match);
    return uuid ? content.apiUrl(uuid) : match;
  });
}

/** Adresy kanoniczne osadzone w treści (`/issue/attachment/content/{uuid}`) — jeden na wpis. */
const CONTENT_URL_PATTERN = /\/issue\/attachment\/content\/([0-9a-fA-F-]{36})/g;

/**
 * Podmienia w HTML-u treści (opis, komentarz) każdy adres kanoniczny załącznika na `blob:`
 * z tokenem — odwrotność podmiany zrobionej przez port przy zapisie.
 *
 * <p>Bez tego `<img src="…/issue/attachment/content/…">` w zapisanym HTML-u dałby 401: ani
 * `<img>`, ani `tui-editor-socket` nie dokładają nagłówka `Authorization`
 * (`docs/guides/frontend/multimedia.md` §3, ten sam powód co przy miniaturkach Catalogu). Adresy
 * pochodzą z tego samego cache’u co kafelki załączników, więc obrazek w treści i w liście
 * załączników dzielą jeden `blob:` i jedno zwolnienie pamięci.</p>
 */
export async function resolveIssueRichTextHtmlAsync(
  html: string | null | undefined,
  content: IssueAttachmentContentService,
): Promise<string> {
  if (!html) {
    return html ?? '';
  }

  const uuids = [...html.matchAll(CONTENT_URL_PATTERN)].map((match) => match[1]);

  if (uuids.length === 0) {
    return html;
  }

  let resolved = html;

  for (const uuid of new Set(uuids)) {
    const blobUrl = await firstDefinedAsync(content.contentUrl(uuid));

    if (blobUrl) {
      resolved = resolved.split(content.apiUrl(uuid)).join(blobUrl);
    }
  }

  return resolved;
}

/** Czeka na pierwszą zdefiniowaną wartość sygnału zawartości — `contentUrl` startuje jako
 * `undefined` i ustawia się asynchronicznie po pobraniu bloba. */
function firstDefinedAsync(getter: { (): string | undefined }): Promise<string | undefined> {
  const immediate = getter();

  if (immediate) {
    return Promise.resolve(immediate);
  }

  return new Promise((resolve) => {
    let attempts = 0;

    const interval = setInterval(() => {
      const value = getter();
      attempts += 1;

      if (value || attempts > 100) {
        clearInterval(interval);
        resolve(value);
      }
    }, 50);
  });
}
