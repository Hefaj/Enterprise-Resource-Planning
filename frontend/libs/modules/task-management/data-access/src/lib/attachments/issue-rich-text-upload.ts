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
 *   <li>po zakończeniu podmienia `blob:` na adres kanoniczny (`/issue/attachment/content/{uuid}`)
 *       WEWNĄTRZ treści kontrolki — to jest ta „podmiana", której `erp-rich-text` świadomie nie
 *       robi (patrz komentarz przy `loadImage` w `erp-rich-text.component.ts`). Bez niej
 *       zrzut ekranu zniknąłby po odświeżeniu strony, bo `blob:` nie przeżywa przeładowania.</li>
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

          const finalUrl = content.apiUrl(attachmentUuid);
          const ctrl = control();
          const current = ctrl?.value;

          if (ctrl && typeof current === 'string' && current.includes(blobUrl)) {
            ctrl.setValue(current.split(blobUrl).join(finalUrl), { emitEvent: false });
          }

          URL.revokeObjectURL(blobUrl);
        })
        .catch((error: unknown) => {
          console.error('[createIssueRichTextUploadPort] Nie udało się wgrać obrazka.', error);
        });
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
 * (`docs/frontend/multimedia.md` §3, ten sam powód co przy miniaturkach Catalogu). Adresy
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
