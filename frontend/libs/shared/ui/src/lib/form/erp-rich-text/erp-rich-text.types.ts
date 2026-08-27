import { TuiEditorToolType } from '@taiga-ui/editor';

import { ErpInputBase } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';

/**
 * Zestaw narzędzi paska formatowania. Podzbiory nazwane, a nie surowa lista `TuiEditorToolType`
 * w każdym wywołaniu — inaczej każdy moduł składałby własny zestaw i dwa opisy w tej samej
 * aplikacji miałyby inne możliwości formatowania.
 */
export type ErpRichTextToolset = 'basic' | 'standard' | 'full';

export interface ErpRichTextConfig extends ErpInputBase {
  /** Treść HTML. Edytor jest `ControlValueAccessor`, więc wartość zwykle wnosi `formControl`;
   * to pole służy użyciu poza formularzem (np. podgląd na karcie). */
  value?: MaybeSignal<string | null | undefined>;

  label?: MaybeSignal<Translatable | undefined>;

  /** Zestaw narzędzi; domyślnie `standard`. */
  toolset?: MaybeSignal<ErpRichTextToolset>;

  /** Jawna lista narzędzi — nadpisuje <see cref="toolset"/>. Dla przypadków, w których
   * nazwany zestaw nie pasuje; sięgaj po nią dopiero wtedy. */
  tools?: MaybeSignal<readonly TuiEditorToolType[] | undefined>;

  /**
   * Tryb podglądu: treść renderuje `tui-editor-socket` — te same style, zero edycji, brak
   * ładowania tiptap. To jest domyślny stan karty zgłoszenia czy dokumentu; edytor wstaje
   * dopiero, gdy użytkownik kliknie „edytuj”.
   */
  readOnly?: MaybeSignal<boolean>;

  /** Minimalna wysokość obszaru edycji w pikselach; domyślnie 160. */
  minHeight?: MaybeSignal<number>;
}
