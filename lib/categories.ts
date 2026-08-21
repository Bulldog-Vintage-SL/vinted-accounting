import categoriesData from "@/data/categories.json";
import Fuse from "fuse.js";

type CategoryNode = {
  id: number;
  title: string;
  path: string;
  catalogs: CategoryNode[];
};

export type FlatCategory = {
  id: number;
  title: string;
  path: string;
  gender: "hombre" | "mujer";
};

const ROOT_GENDER_MAP: Record<string, "hombre" | "mujer"> = {
  Mujer: "mujer",
  Hombre: "hombre",
};

function flattenLeaves(
  nodes: CategoryNode[],
  gender: "hombre" | "mujer"
): FlatCategory[] {
  const result: FlatCategory[] = [];

  for (const node of nodes) {
    const fullPath = node.path ? `${node.path} > ${node.title}` : node.title;

    if (!node.catalogs || node.catalogs.length === 0) {
      result.push({ id: node.id, title: node.title, path: fullPath, gender });
    } else {
      result.push(...flattenLeaves(node.catalogs, gender));
    }
  }

  return result;
}

let cached: FlatCategory[] | null = null;

export function getFlatCategories(): FlatCategory[] {
  if (cached) return cached;

  const roots = (categoriesData.catalogs as CategoryNode[]).filter(
    root => root.title in ROOT_GENDER_MAP
  );

  cached = roots.flatMap(root =>
    flattenLeaves(root.catalogs, ROOT_GENDER_MAP[root.title])
  );

  return cached;
}

export function findCategoryById(id: number): FlatCategory | undefined {
  return getFlatCategories().find(c => c.id === id);
}

let hombreFuse: Fuse<FlatCategory> | null = null;

function getHombreFuse(): Fuse<FlatCategory> {
  if (!hombreFuse) {
    const hombreCategories = getFlatCategories().filter(c => c.gender === "hombre");
    hombreFuse = new Fuse(hombreCategories, {
      keys: ["title"],
      threshold: 0.4,
      ignoreDiacritics: true,
    });
  }
  return hombreFuse;
}

export function findClosestHombreCategory(title: string): FlatCategory | null {
  const results = getHombreFuse().search(title);
  return results.length > 0 ? results[0].item : null;
}