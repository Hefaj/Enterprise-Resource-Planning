import { TuiEditorTool, TuiEditorToolType } from '@taiga-ui/editor';

import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpRichTextConfig, ErpRichTextImageUploadPort, ErpRichTextToolset } from './erp-rich-text.types';

/**
 * Nazwane zestawy narzędzi paska formatowania.
 *
 * <p><b>`basic`</b> — komentarz albo krótka notatka: pogrubienie, kursywa, lista, link, cofnij.
 * <b>`standard`</b> — opis zgłoszenia czy dokumentu: dochodzi kod, cytat, nagłówki przez rozmiar,
 * wyrównanie i linia pozioma. <b>`full`</b> — dokładka dla treści redakcyjnej: tabele, kolory,
 * indeksy, szczegóły rozwijane.</p>
 *
 * <p>Żaden z nazwanych zestawów nie zawiera `TuiEditorTool.Img` na stałe: wstawienie obrazka
 * wymaga wgrania pliku do magazynu modułu i referencji, po której da się posprzątać
 * (`docs/backend/media-storage.md`). Komponent dokłada przycisk obrazka do zestawu sam,
 * gdy konfiguracja dostanie {@link ErpRichTextImageUploadPort} przez `setUploadImage` — bez
 * portu wklejenie czy przeciągnięcie obrazka jest cicho ignorowane, tak jak dziś.</p>
 */
const TOOLSETS: Record<ErpRichTextToolset, readonly TuiEditorToolType[]> = {
  basic: [TuiEditorTool.Undo, TuiEditorTool.Bold, TuiEditorTool.Italic, TuiEditorTool.List, TuiEditorTool.Link],
  standard: [
    TuiEditorTool.Undo,
    TuiEditorTool.Size,
    TuiEditorTool.Bold,
    TuiEditorTool.Italic,
    TuiEditorTool.Underline,
    TuiEditorTool.Strikethrough,
    TuiEditorTool.Align,
    TuiEditorTool.List,
    TuiEditorTool.Quote,
    TuiEditorTool.Code,
    TuiEditorTool.Link,
    TuiEditorTool.HR,
    TuiEditorTool.Clear,
  ],
  full: [
    TuiEditorTool.Undo,
    TuiEditorTool.Size,
    TuiEditorTool.Bold,
    TuiEditorTool.Italic,
    TuiEditorTool.Underline,
    TuiEditorTool.Strikethrough,
    TuiEditorTool.Align,
    TuiEditorTool.List,
    TuiEditorTool.Quote,
    TuiEditorTool.Code,
    TuiEditorTool.Link,
    TuiEditorTool.HR,
    TuiEditorTool.Color,
    TuiEditorTool.Hilite,
    TuiEditorTool.Sub,
    TuiEditorTool.Sup,
    TuiEditorTool.Table,
    TuiEditorTool.RowsColumnsManaging,
    TuiEditorTool.MergeCells,
    TuiEditorTool.SplitCells,
    TuiEditorTool.CellColor,
    TuiEditorTool.Details,
    TuiEditorTool.Clear,
  ],
};

/** Narzędzia dla nazwanego zestawu — używane przez komponent, nie przez wywołującego. */
export function erpRichTextToolset(toolset: ErpRichTextToolset): readonly TuiEditorToolType[] {
  return TOOLSETS[toolset];
}

/** Fluent API konfiguracji `erp-rich-text` (wzorzec Single Config Builder, `docs/frontend/atoms.md`). */
export class ErpRichTextBuilder extends ErpInputBaseBuilder<ErpRichTextConfig> {
  public setValue(value: MaybeSignal<string | null | undefined>): this {
    this._data.value = value;
    return this;
  }

  public setLabel(label: MaybeSignal<Translatable | undefined>): this {
    this._data.label = label;
    return this;
  }

  /** Nazwany zestaw narzędzi paska formatowania. */
  public setToolset(toolset: MaybeSignal<ErpRichTextToolset>): this {
    this._data.toolset = toolset;
    return this;
  }

  /** Jawna lista narzędzi — nadpisuje zestaw nazwany. */
  public setTools(tools: MaybeSignal<readonly TuiEditorToolType[] | undefined>): this {
    this._data.tools = tools;
    return this;
  }

  /** Tryb podglądu: treść bez edytora i bez ładowania tiptap. */
  public setReadOnly(readOnly: MaybeSignal<boolean>): this {
    this._data.readOnly = readOnly;
    return this;
  }

  public setMinHeight(minHeight: MaybeSignal<number>): this {
    this._data.minHeight = minHeight;
    return this;
  }

  /** Port wgrywania obrazków wklejonych/przeciągniętych — patrz {@link ErpRichTextImageUploadPort}. */
  public setUploadImage(uploadImage: MaybeSignal<ErpRichTextImageUploadPort | undefined>): this {
    this._data.uploadImage = uploadImage;
    return this;
  }
}
