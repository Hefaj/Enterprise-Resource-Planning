export const TECHNICAL_DOCUMENT_KINDS = new Set([
  'overview',
  'architecture',
  'guide',
  'module-specification',
  'operations',
  'reference',
  'decision',
  'contributing',
]);

export const REQUIRED_TECHNICAL_METADATA_FIELDS = [
  'id',
  'title',
  'summary',
  'kind',
  'scope',
  'audience',
  'triggers',
  'related',
];

export function validateTechnicalMetadata(metadata, filePath) {
  const errors = [];

  for (const field of REQUIRED_TECHNICAL_METADATA_FIELDS) {
    if (!(field in metadata)) {
      errors.push(`${filePath}: missing front matter field "${field}"`);
    }
  }

  for (const field of ['id', 'title', 'summary', 'kind', 'scope']) {
    if (field in metadata && (typeof metadata[field] !== 'string' || !metadata[field].trim())) {
      errors.push(`${filePath}: front matter field "${field}" must be a non-empty string`);
    }
  }

  for (const field of ['audience', 'triggers', 'related']) {
    if (field in metadata && (!Array.isArray(metadata[field]) || metadata[field].some((value) => typeof value !== 'string'))) {
      errors.push(`${filePath}: front matter field "${field}" must be an array of strings`);
    }
  }

  if (metadata.kind && !TECHNICAL_DOCUMENT_KINDS.has(metadata.kind)) {
    errors.push(`${filePath}: unsupported document kind "${metadata.kind}"`);
  }

  if (metadata.kind === 'plan') {
    errors.push(`${filePath}: implementation plans belong in plans/, not docs/`);
  }

  return errors;
}

export function slugifyHeading(value) {
  return value
    .normalize('NFC')
    .toLocaleLowerCase('pl-PL')
    .trim()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}_\s-]/gu, '')
    .replace(/\s/g, '-')
    .replace(/^-|-$/g, '');
}

export function collectHeadingAnchors(markdown) {
  const anchors = new Set();
  const occurrences = new Map();

  for (const line of markdown.split(/\r?\n/)) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;

    const base = slugifyHeading(match[2]);
    const count = occurrences.get(base) ?? 0;
    occurrences.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }

  return anchors;
}
