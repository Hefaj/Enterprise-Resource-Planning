import { CategoryDto } from '../../api-client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MOCK — źródło danych dla drzewa kategorii, do zastąpienia realnymi endpointami.
 *
 * Backend NIE udostępnia dziś zapytań hierarchicznych (`searchCategory` zwraca tylko
 * płaską listę filtrowaną po `name`). Poniższe funkcje symulują docelowe endpointy,
 * żeby `erp-tree`/`erp-tree-picker` dało się zbudować i przetestować od razu, a wymianę
 * na prawdziwe wywołania HTTP ograniczyć do treści `catalog-category.orchestrator.ts`
 * (sygnatury metod publicznych orkiestratora się nie zmienią).
 *
 * ── Docelowa struktura danych (backend) ──────────────────────────────────────────
 * Rekomendacja: closure table — tabela `CategoryClosure(AncestorUuid, DescendantUuid, Depth)`
 * obok istniejącej `Category`. Pozwala odpowiedzieć jednym tanim zapytaniem zarówno
 * "dzieci X" (Depth=1), jak i "wszyscy potomkowie X" (dowolny Depth), bez limitu
 * parametrów SQL, bo zapytania filtrują po AncestorUuid (garść wartości), nie po
 * wypisanej liście DescendantUuid (potencjalnie tysiące).
 *
 * ── Docelowe endpointy ────────────────────────────────────────────────────────────
 *
 * 1) GET /api/catalog/categories/children
 *    Request:  { parentUuid: Guid | null, page: number, pageSize: number, search?: string }
 *    Response: {
 *      nodes: Array<{
 *        uuid: string; name: string; parentUuid: string | null;
 *        hasChildren: boolean; childCount: number; descendantCount: number;
 *      }>;
 *      totalCount: number;
 *    }
 *    SQL (closure table, parentUuid = null → korzenie):
 *      SELECT c.*, EXISTS(SELECT 1 FROM CategoryClosure cc WHERE cc.AncestorUuid = c.Uuid AND cc.Depth = 1) AS HasChildren,
 *             (SELECT COUNT(*) FROM CategoryClosure cc WHERE cc.AncestorUuid = c.Uuid AND cc.Depth = 1) AS ChildCount,
 *             (SELECT COUNT(*) FROM CategoryClosure cc WHERE cc.AncestorUuid = c.Uuid) AS DescendantCount
 *      FROM Category c
 *      WHERE c.ParentUuid = @parentUuid OR (@parentUuid IS NULL AND c.ParentUuid IS NULL)
 *      ORDER BY c.Name OFFSET @page*@pageSize ROWS FETCH NEXT @pageSize ROWS ONLY;
 *
 * 2) GET /api/catalog/categories/search-tree
 *    Request:  { search: string }
 *    Response: { matches: CategoryNodeDto[]; ancestors: CategoryNodeDto[]; totalCount: number }
 *    `ancestors` = przodkowie dopasowań (JOIN po CategoryClosure), żeby front mógł
 *    pokazać wynik w kontekście hierarchii bez dodatkowych zapytań.
 *
 * 3) POST /api/catalog/categories/resolve-descendants
 *    Request:  { uuids: string[] }           // korzenie poddrzew (garść wartości)
 *    Response: { uuids: string[]; truncated: boolean }   // limit np. 10 000
 *    Furtka awaryjna: backend rozwija poddrzewo jednym wywołaniem, gdy front (filtr)
 *    potrzebuje płaskiej listy identyfikatorów zamiast przekazywać do dalszego
 *    zapytania sam deskryptor selekcji ({ subtreeRoots, excluded }).
 * ═══════════════════════════════════════════════════════════════════════════════
 */

interface MockNode {
  name: string;
  children?: MockNode[];
}

const MOCK_TREE: MockNode[] = [
  {
    name: 'Elektronika',
    children: [
      {
        name: 'AGD',
        children: [
          { name: 'Duże AGD', children: [{ name: 'Pralki' }, { name: 'Zmywarki' }, { name: 'Lodówki' }, { name: 'Piekarniki' }] },
          { name: 'Małe AGD', children: [{ name: 'Czajniki' }, { name: 'Blendery' }, { name: 'Ekspresy do kawy' }, { name: 'Roboty kuchenne' }] },
        ],
      },
      {
        name: 'RTV',
        children: [
          { name: 'Telewizory' },
          { name: 'Głośniki' },
          { name: 'Soundbary' },
          { name: 'Amplitunery' },
        ],
      },
      {
        name: 'Komputery',
        children: [
          { name: 'Laptopy' },
          { name: 'Komputery stacjonarne' },
          { name: 'Monitory' },
          { name: 'Podzespoły', children: [{ name: 'Procesory' }, { name: 'Karty graficzne' }, { name: 'Pamięć RAM' }, { name: 'Dyski SSD' }] },
        ],
      },
      { name: 'Telefony i tablety', children: [{ name: 'Smartfony' }, { name: 'Tablety' }, { name: 'Akcesoria do telefonów' }] },
    ],
  },
  {
    name: 'Odzież',
    children: [
      {
        name: 'Odzież męska',
        children: [{ name: 'Koszule' }, { name: 'Spodnie' }, { name: 'Kurtki' }, { name: 'Bielizna męska' }],
      },
      {
        name: 'Odzież damska',
        children: [{ name: 'Sukienki' }, { name: 'Bluzki' }, { name: 'Spódnice' }, { name: 'Bielizna damska' }],
      },
      { name: 'Odzież dziecięca', children: [{ name: 'Niemowlęca' }, { name: 'Dla przedszkolaków' }, { name: 'Dla nastolatków' }] },
      { name: 'Obuwie', children: [{ name: 'Obuwie sportowe' }, { name: 'Obuwie eleganckie' }, { name: 'Kapcie' }] },
    ],
  },
  {
    name: 'Dom i Ogród',
    children: [
      { name: 'Meble', children: [{ name: 'Meble do salonu' }, { name: 'Meble do sypialni' }, { name: 'Meble ogrodowe' }] },
      { name: 'Oświetlenie', children: [{ name: 'Lampy sufitowe' }, { name: 'Lampy stołowe' }, { name: 'Taśmy LED' }] },
      { name: 'Ogród', children: [{ name: 'Narzędzia ogrodowe' }, { name: 'Meble ogrodowe' }, { name: 'Nawadnianie' }] },
      { name: 'Tekstylia domowe', children: [{ name: 'Pościel' }, { name: 'Ręczniki' }, { name: 'Zasłony' }] },
    ],
  },
  {
    name: 'Narzędzia',
    children: [
      { name: 'Elektronarzędzia', children: [{ name: 'Wiertarki' }, { name: 'Szlifierki' }, { name: 'Piły' }] },
      { name: 'Narzędzia ręczne', children: [{ name: 'Klucze' }, { name: 'Śrubokręty' }, { name: 'Młotki' }] },
      { name: 'Pomiary', children: [{ name: 'Miary' }, { name: 'Poziomice' }, { name: 'Mierniki laserowe' }] },
    ],
  },
  {
    name: 'Biuro i Papeteria',
    children: [
      { name: 'Artykuły piśmienne' },
      { name: 'Papier i druk' },
      { name: 'Meble biurowe', children: [{ name: 'Krzesła biurowe' }, { name: 'Biurka' }] },
    ],
  },
  {
    name: 'Motoryzacja',
    children: [
      { name: 'Części samochodowe', children: [{ name: 'Filtry' }, { name: 'Hamulce' }, { name: 'Oleje i płyny' }] },
      { name: 'Akcesoria samochodowe', children: [{ name: 'Dywaniki' }, { name: 'Pokrowce' }, { name: 'Nawigacje' }] },
    ],
  },
  {
    name: 'Sport i Rekreacja',
    children: [
      { name: 'Rowery', children: [{ name: 'Rowery górskie' }, { name: 'Rowery szosowe' }, { name: 'Akcesoria rowerowe' }] },
      { name: 'Fitness', children: [{ name: 'Hantle' }, { name: 'Maty' }, { name: 'Ekspandery' }] },
      { name: 'Turystyka', children: [{ name: 'Namioty' }, { name: 'Śpiwory' }, { name: 'Plecaki' }] },
    ],
  },
];

let _uuidCounter = 0;
function nextUuid(): string {
  _uuidCounter += 1;
  return `mock-cat-${_uuidCounter.toString().padStart(4, '0')}`;
}

function flatten(nodes: MockNode[], parentUuid: string | null, acc: CategoryDto[]): void {
  for (const node of nodes) {
    const uuid = nextUuid();
    acc.push({ uuid, name: node.name, parentUuid: parentUuid ?? undefined });
    if (node.children && node.children.length > 0) {
      flatten(node.children, uuid, acc);
    }
  }
}

/** Płaska lista wszystkich mockowych kategorii — do użycia bezpośrednio w trybie 'client'. */
export const MOCK_CATEGORY_DTOS: CategoryDto[] = (() => {
  const acc: CategoryDto[] = [];
  flatten(MOCK_TREE, null, acc);
  return acc;
})();

const byUuid = new Map(MOCK_CATEGORY_DTOS.map((dto) => [dto.uuid, dto]));
const childrenOf = new Map<string | null, CategoryDto[]>();
for (const dto of MOCK_CATEGORY_DTOS) {
  const key = dto.parentUuid ?? null;
  if (!childrenOf.has(key)) childrenOf.set(key, []);
  childrenOf.get(key)!.push(dto);
}

function directChildCount(uuid: string): number {
  return (childrenOf.get(uuid) ?? []).length;
}

function descendantCount(uuid: string): number {
  const direct = childrenOf.get(uuid) ?? [];
  let total = direct.length;
  for (const child of direct) total += descendantCount(child.uuid);
  return total;
}

function ancestorsOf(uuid: string): CategoryDto[] {
  const result: CategoryDto[] = [];
  let current = byUuid.get(uuid);
  const seen = new Set<string>();
  while (current?.parentUuid && !seen.has(current.parentUuid)) {
    seen.add(current.parentUuid);
    const parent = byUuid.get(current.parentUuid);
    if (!parent) break;
    result.push(parent);
    current = parent;
  }
  return result;
}

/** Symuluje opóźnienie sieciowe realnego wywołania API (150–400ms). */
function networkDelay<T>(value: T): Promise<T> {
  const ms = 150 + Math.random() * 250;
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export interface MockCategoryNode {
  dto: CategoryDto;
  hasChildren: boolean;
  childCount: number;
  descendantCount: number;
}

function toMockNode(dto: CategoryDto): MockCategoryNode {
  return {
    dto,
    hasChildren: directChildCount(dto.uuid) > 0,
    childCount: directChildCount(dto.uuid),
    descendantCount: descendantCount(dto.uuid),
  };
}

/** MOCK dla `GET /api/catalog/categories/children` — patrz komentarz na górze pliku. */
export async function mockGetCategoryChildren(
  parentUuid: string | null,
  pageIndex: number,
  pageSize: number,
): Promise<{ nodes: MockCategoryNode[]; totalCount: number }> {
  const all = (childrenOf.get(parentUuid) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
  const start = pageIndex * pageSize;
  const page = all.slice(start, start + pageSize).map(toMockNode);
  return networkDelay({ nodes: page, totalCount: all.length });
}

/** MOCK dla `GET /api/catalog/categories/search-tree` — patrz komentarz na górze pliku. */
export async function mockSearchCategoryTree(
  search: string,
): Promise<{ matches: MockCategoryNode[]; ancestors: MockCategoryNode[]; totalCount: number }> {
  const term = search.trim().toLowerCase();
  if (!term) return networkDelay({ matches: [], ancestors: [], totalCount: 0 });

  const matches = MOCK_CATEGORY_DTOS.filter((dto) => dto.name.toLowerCase().includes(term));
  const ancestorUuids = new Set<string>();
  const ancestorDtos: CategoryDto[] = [];
  for (const match of matches) {
    for (const ancestor of ancestorsOf(match.uuid)) {
      if (!ancestorUuids.has(ancestor.uuid)) {
        ancestorUuids.add(ancestor.uuid);
        ancestorDtos.push(ancestor);
      }
    }
  }

  return networkDelay({
    matches: matches.map(toMockNode),
    ancestors: ancestorDtos.map(toMockNode),
    totalCount: matches.length,
  });
}

/** MOCK dla `POST /api/catalog/categories/resolve-descendants` — patrz komentarz na górze pliku. */
export async function mockResolveCategoryDescendants(uuids: string[], limit = 10_000): Promise<string[]> {
  const result = new Set<string>();
  const collect = (uuid: string) => {
    if (result.size >= limit) return;
    result.add(uuid);
    for (const child of childrenOf.get(uuid) ?? []) collect(child.uuid);
  };
  for (const uuid of uuids) collect(uuid);
  return networkDelay([...result]);
}
