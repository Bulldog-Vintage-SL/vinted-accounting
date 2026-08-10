"use client";

import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
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

type Gender = "hombre" | "mujer" | "unisex";

const GENDER_BY_ROOT: Record<string, Gender> = {
  Mujer: "mujer",
  Hombre: "hombre",
};

type CategorySelectInfo = {
  fullPath: string;
  leaf: Category | null;
  root: Category | null;
  gender: Gender | null;
};

type CategorySelectProps = {
  value: string;
  /** Si el género actual del form es "unisex", pásalo aquí para que el switch arranque activado. */
  unisex?: boolean;
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

export default function CategorySelect({ value, unisex, onChange }: CategorySelectProps) {
  const [path, setPath] = useState<Category[]>(() => resolvePathFromString(value));
  const [isUnisex, setIsUnisex] = useState(unisex ?? false);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isLeafSelected = path.length > 0 && path[path.length - 1].catalogs.length === 0;
  const canDismiss = path.length === 0 || isLeafSelected;
  const rootGender: Gender | null = path.length > 0 ? (GENDER_BY_ROOT[path[0].title] ?? null) : null;

  useEffect(() => {
    setMounted(true);
  }, []);

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
    setIsUnisex(unisex ?? false);
  }, [unisex]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && canDismiss) setIsOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, canDismiss]);

  const emitChange = (newPath: Category[], unisexOverride: boolean) => {
    const root = newPath.length ? newPath[0] : null;
    const leaf = newPath.length ? newPath[newPath.length - 1] : null;
    const derivedGender = root ? (GENDER_BY_ROOT[root.title] ?? null) : null;
    const gender = newPath.length === 0 ? null : (unisexOverride ? "unisex" : derivedGender);

    onChange({
      fullPath: newPath.map(c => c.title).join(" > "),
      leaf,
      root,
      gender,
    });
  };

  const setPathAndEmit = (newPath: Category[]) => {
    // Cambiar de categoría resetea el switch: el género "por defecto" del
    // nuevo root puede no tener nada que ver con el anterior.
    setPath(newPath);
    setIsUnisex(false);
    emitChange(newPath, false);
  };

  const toggleUnisex = () => {
    const next = !isUnisex;
    setIsUnisex(next);
    emitChange(path, next);
  };

  const selectAt = (depth: number, rawId: string) => {
    if (rawId === "") {
      setPathAndEmit(path.slice(0, depth));
      return;
    }

    const options = depth === 0 ? data.catalogs : path[depth - 1].catalogs;
    const id = Number(rawId);
    const selected = options.find(c => c.id === id) ?? null;

    setPathAndEmit(selected ? [...path.slice(0, depth), selected] : path.slice(0, depth));
  };

  const jumpTo = (depth: number) => setPathAndEmit(path.slice(0, depth + 1));

  const clear = () => setPathAndEmit([]);

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

  const overlay = isOpen && (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
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

          {/* Switch de unisex: solo tiene sentido una vez hay una categoría final,
              porque necesitamos el root para saber cual es el género "por defecto". */}
          {isLeafSelected && (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-gray-900">¿Es unisex?</p>
                <p className="text-xs text-gray-400">
                  {isUnisex
                    ? "Se guardará como unisex"
                    : rootGender
                      ? `Por defecto: ${rootGender}`
                      : "Sin género detectado en esta categoría"}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isUnisex}
                onClick={toggleUnisex}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${isUnisex ? "bg-blue-600" : "bg-gray-200"
                  }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isUnisex ? "translate-x-6" : "translate-x-1"
                    }`}
                />
              </button>
            </div>
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
  );

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

      <DialogPrimitive.Root
        open={isOpen}
        onOpenChange={(next) => {
          if (!next && !canDismiss) return;
          setIsOpen(next);
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content
            onPointerDownOutside={(e) => {
              if (!canDismiss) e.preventDefault();
            }}
            onEscapeKeyDown={(e) => {
              if (!canDismiss) e.preventDefault();
            }}
            className="contents"
          >
            {overlay}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}