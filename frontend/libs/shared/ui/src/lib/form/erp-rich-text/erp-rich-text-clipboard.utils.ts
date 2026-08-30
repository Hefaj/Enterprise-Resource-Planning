import { concatMap, from, Observable, take } from 'rxjs';

/**
 * Zwraca pliki obrazów wystawione przez natywne zdarzenie wklejania.
 *
 * Chromium zwykle wypełnia `DataTransfer.files`, ale przy części screenshotów i aplikacji
 * systemowych udostępnia obraz wyłącznie przez `DataTransfer.items`. Oba warianty są
 * równoważne dla uploadu, a duplikat występujący w obu kolekcjach ma trafić do edytora raz.
 */
export function erpClipboardImageFiles(transfer: Pick<DataTransfer, 'files' | 'items'> | null): File[] {
  if (!transfer) {
    return [];
  }

  const fromFiles = Array.from(transfer.files).filter((file) => file.type.startsWith('image/'));
  const fromItems = Array.from(transfer.items)
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);

  return [...new Set([...fromFiles, ...fromItems])];
}

/**
 * Obsługuje natywne wklejenie obrazów, nie ingerując w normalne wklejanie tekstu i HTML-a.
 * Zwraca strumień adresów obrazów wyłącznie wtedy, gdy zdarzenie zawierało obraz.
 */
export function erpClipboardImageUrls(
  event: Pick<ClipboardEvent, 'clipboardData' | 'preventDefault' | 'stopPropagation'>,
  imageLoader: (image: File) => Observable<string>,
): Observable<string> | null {
  const transfer = event.clipboardData;

  if (!transfer) {
    return null;
  }

  const browserFiles = Array.from(transfer.files).filter((file) => file.type.startsWith('image/'));

  // Taiga obsługuje `clipboardData.files` i potrafi zachować dokładną pozycję kursora z
  // chwili wklejenia. Gdy plik tu istnieje, nie wolno wywołać loadera drugi raz — właśnie
  // to zakładałoby dwa załączniki dla jednego zrzutu ekranu.
  if (browserFiles.length > 0) {
    return null;
  }

  const images = Array.from(transfer.items)
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);

  if (images.length === 0) {
    return null;
  }

  // Zatrzymujemy wbudowany handler Taiga — ten rozpoznaje tylko `clipboardData.files`
  // i przy niektórych zrzutach ekranowych nie zrobiłby nic.
  event.preventDefault();
  event.stopPropagation();

  return from(images).pipe(concatMap((image) => imageLoader(image).pipe(take(1))));
}
