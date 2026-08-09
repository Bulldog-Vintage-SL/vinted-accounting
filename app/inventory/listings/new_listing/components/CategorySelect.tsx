"use client";

import { useEffect, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import categoriesData from "@/data/categories.json";

export type Category = {
  id: number;
  title: string;
  path: string;
  catalogs: Category[];
};

type CategoriesFile = {
  catalogs: Category[];
};

const data = categoriesData as unknown as CategoriesFile;

type CategorySelectInfo = {
  fullPath: string;
  leaf: Category | null;
  root: Category | null;
};

type CategorySelectProps = {
  value: string;
  onChange: (info: CategorySelectInfo) => void;
};

function resolvePathFromString(titlePath: string): Category[] {
  if (!titlePath) return [];

  const titles = titlePath.split(">").map(t => t.trim()).filter(Boolean);
  const resolved: Category[] = [];
  let currentOptions = data.catalogs;

  for (const title of titles) {
    const match = currentOptions.find(c => c.title === title);
    if (!match) break;
    resolved.push(match);
    currentOptions = match.catalogs ?? [];
  }

  return resolved;
}

export default function CategorySelect({ value, onChange }: CategorySelectProps) {
  const [path, setPath] = useState<Category[]>(() => resolvePathFromString(value));
  const [isOpen, setIsOpen] = useState(false);

  const isLeafSelected = path.length > 0 && path[path.length - 1].catalogs.length === 0;
  const canDismiss = path.length === 0 || isLeafSelected;

  useEffect(() => {
    const currentTitlePath = path.map(c => c.title).join(" > ");

    if (value && value !== currentTitlePath) {
      setPath(resolvePathFromString(value));
    } else if (!value && path.length > 0) {
      setPath([]);
    }
    // Solo re-resolvemos cuando cambia el valor externo (p.ej. al editar un
    // anuncio existente), no en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && canDismiss) setIsOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, canDismiss]);

  const emit = (newPath: Category[]) => {
    setPath(newPath);
    onChange({
      fullPath: newPath.map(c => c.title).join(" > "),
      leaf: newPath.length ? newPath[newPath.length - 1] : null,
      root: newPath.length ? newPath[0] : null,
    });

    const reachedLeaf = newPath.length > 0 && newPath[newPath.length - 1].catalogs.length === 0;
    if (reachedLeaf) setIsOpen(false);
  };

  const selectAt = (depth: number, rawId: string) => {
    if (rawId === "") {
      emit(path.slice(0, depth));
      return;
    }

    const options = depth === 0 ? data.catalogs : path[depth - 1].catalogs;
    const id = Number(rawId);
    const selected = options.find(c => c.id === id) ?? null;

    emit(selected ? [...path.slice(0, depth), selected] : path.slice(0, depth));
  };

  const jumpTo = (depth: number) => emit(path.slice(0, depth + 1));

  const clear = () => emit([]);

  const levels: { options: Category[]; selectedId: number | "" }[] = [];
  let currentOptions = data.catalogs;

  for (let depth = 0; depth <= path.length; depth++) {
    if (currentOptions.length === 0) break;

    const selectedNode = path[depth];
    levels.push({ options: currentOptions, selectedId: selectedNode ? selectedNode.id : "" });

    if (!selectedNode) break;
    currentOptions = selectedNode.catalogs ?? [];
  }

  const displayPath = path.map(c => c.title).join(" > ");

  return (
    <>
      {/* Campo visible, mismo tamaño que el resto de inputs del form */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-1 w-full rounded-md border border-gray-300 p-2 text-left flex items-center justify-between gap-2 hover:border-gray-400 transition-colors"
      >
        <span className={`truncate ${displayPath ? "text-gray-900" : "text-gray-400"}`}>
          {displayPath || "Selecciona una categoría"}
        </span>
        <ChevronDown size={16} className="text-gray-400 shrink-0" />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
          onClick={e => {
            if (e.target === e.currentTarget && canDismiss) setIsOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Selecciona una categoría</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto px-5 pb-5 space-y-3">
              {path.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {path.map((node, i) => (
                    <span key={node.id} className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => jumpTo(i)}
                        className="text-xs bg-gray-50 hover:bg-blue-50 hover:text-blue-600 text-gray-600 px-2.5 py-1 rounded-full transition-colors"
                      >
                        {node.title}
                      </button>
                      {i < path.length - 1 && <span className="text-gray-300 text-xs">/</span>}
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={clear}
                    className="text-xs text-red-400 hover:text-red-600 ml-1 transition-colors"
                  >
                    Limpiar
                  </button>
                </div>
              )}

              {levels.map((level, depth) => (
                <div key={depth} className="relative">
                  <select
                    value={level.selectedId}
                    onChange={e => selectAt(depth, e.target.value)}
                    className="w-full appearance-none rounded-lg border border-gray-200 bg-white py-2.5 pl-3 pr-9 text-sm text-gray-900 shadow-sm hover:border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                  >
                    <option value="">
                      {depth === 0 ? "Selecciona una categoría" : "Selecciona subcategoría"}
                    </option>
                    {level.options.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                </div>
              ))}

              {path.length > 0 && !isLeafSelected && (
                <p className="text-xs text-amber-600">
                  Sigue eligiendo hasta llegar a una categoría final.
                </p>
              )}
            </div>

            <div className="bg-gray-50 px-5 py-3 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={!isLeafSelected}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Hecho
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}