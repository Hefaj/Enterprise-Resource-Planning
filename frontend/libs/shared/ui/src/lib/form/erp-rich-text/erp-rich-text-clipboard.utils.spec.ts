import { describe, expect, it, vi } from 'vitest';
import { firstValueFrom, of } from 'rxjs';

import { erpClipboardImageFiles, erpClipboardImageUrls } from './erp-rich-text-clipboard.utils';

const screenshot = new File(['image'], 'screenshot.png', { type: 'image/png' });
const textFile = new File(['text'], 'note.txt', { type: 'text/plain' });

function transfer(files: File[] = [], items: DataTransferItem[] = []): Pick<DataTransfer, 'files' | 'items'> {
  return {
    files: files as unknown as FileList,
    items: items as unknown as DataTransferItemList,
  };
}

describe('erpClipboardImageFiles', () => {
  it('pobiera obraz z clipboardData.files', () => {
    expect(erpClipboardImageFiles(transfer([screenshot, textFile]))).toEqual([screenshot]);
  });

  it('pobiera obraz ze screenshotu wystawionego tylko przez clipboardData.items', () => {
    const imageItem = {
      kind: 'file',
      type: 'image/png',
      getAsFile: (): File => screenshot,
    } as DataTransferItem;

    expect(erpClipboardImageFiles(transfer([], [imageItem]))).toEqual([screenshot]);
  });

  it('nie wstawia tego samego pliku drugi raz, gdy przeglądarka wystawi go w obu kolekcjach', () => {
    const imageItem = {
      kind: 'file',
      type: 'image/png',
      getAsFile: (): File => screenshot,
    } as DataTransferItem;

    expect(erpClipboardImageFiles(transfer([screenshot], [imageItem]))).toEqual([screenshot]);
  });
});

describe('erpClipboardImageUrls', () => {
  it('uruchamia loader i blokuje wbudowane wklejanie dla obrazu ze schowka', async () => {
    const imageItem = {
      kind: 'file',
      type: 'image/png',
      getAsFile: (): File => screenshot,
    } as DataTransferItem;
    const event = {
      clipboardData: transfer([], [imageItem]),
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };
    const imageLoader = vi.fn(() => of('blob:test-image'));

    const imageUrls = erpClipboardImageUrls(event, imageLoader);

    expect(imageUrls).not.toBeNull();
    if (!imageUrls) {
      throw new Error('Obraz ze schowka powinien uruchomić loader.');
    }

    await expect(firstValueFrom(imageUrls)).resolves.toBe('blob:test-image');

    expect(imageLoader).toHaveBeenCalledWith(screenshot);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
  });

  it('oddaje Taiga obsługę obrazu, gdy przeglądarka wystawia go w clipboardData.files', () => {
    const event = {
      clipboardData: transfer([screenshot]),
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };
    const imageLoader = vi.fn(() => of('blob:test-image'));

    expect(erpClipboardImageUrls(event, imageLoader)).toBeNull();
    expect(imageLoader).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
  });

  it('pozostawia wbudowane wklejanie dla samego tekstu', () => {
    const event = {
      clipboardData: transfer([textFile]),
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };

    expect(erpClipboardImageUrls(event, vi.fn())).toBeNull();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
  });
});
