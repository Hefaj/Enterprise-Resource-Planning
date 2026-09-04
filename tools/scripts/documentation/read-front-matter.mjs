import { parse } from 'yaml';

const FRONT_MATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function readFrontMatter(source, filePath = '<document>') {
  const match = FRONT_MATTER_PATTERN.exec(source);
  if (!match) {
    throw new Error(`${filePath}: missing YAML front matter`);
  }

  let metadata;
  try {
    metadata = parse(match[1]);
  } catch (error) {
    throw new Error(`${filePath}: invalid YAML front matter: ${error.message}`);
  }

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error(`${filePath}: front matter must be a YAML object`);
  }

  return {
    metadata,
    body: source.slice(match[0].length),
  };
}
