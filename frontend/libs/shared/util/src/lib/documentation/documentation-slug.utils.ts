export function erpNormalizeDocumentationText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pl-PL')
    .replaceAll('ł', 'l')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function erpDocumentationSlug(value: string): string {
  return erpNormalizeDocumentationText(value).replaceAll(' ', '-');
}

export function erpIsDocumentationSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
