"use client";

import { useEffect, useRef, useState } from "react";

type BrandSelectProps = {
  value: string;
  onChange: (brand: string) => void;
};

const NO_BRAND_OPTION = "Sin marca";
const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

export default function BrandSelect({ value, onChange }: BrandSelectProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Búsqueda al backend con debounce, cancelando la petición anterior si aún no ha vuelto.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      fetch(`/api/brands/search?q=${encodeURIComponent(query.trim())}`, {
        signal: controller.signal,
      })
        .then(res => res.json())
        .then((data: string[]) => setResults(data))
        .catch(err => {
          if (err.name !== "AbortError") console.error("Error buscando marcas:", err);
        })
        .finally(() => setIsLoading(false));
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery(value);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  const handleSelect = (brand: string) => {
    onChange(brand);
    setQuery(brand);
    setIsOpen(false);
  };

  const showEmptyHint = query.trim().length < MIN_QUERY_LENGTH;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Busca una marca"
        className="mt-1 w-full rounded-md border border-gray-300 p-2"
        autoComplete="off"
      />

      {isOpen && (
        <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          <li
            onClick={() => handleSelect(NO_BRAND_OPTION)}
            className={`px-3 py-2 text-sm cursor-pointer italic border-b border-gray-200 ${
              value === NO_BRAND_OPTION
                ? "bg-blue-100 font-medium text-blue-700"
                : "text-blue-600 bg-blue-50 hover:bg-blue-100"
            }`}
          >
            {NO_BRAND_OPTION}
          </li>

          {showEmptyHint ? (
            <li className="px-3 py-2 text-sm text-gray-400">
              Escribe al menos {MIN_QUERY_LENGTH} letras...
            </li>
          ) : isLoading ? (
            <li className="px-3 py-2 text-sm text-gray-400">Buscando...</li>
          ) : results.length > 0 ? (
            results.map(brand => (
              <li
                key={brand}
                onClick={() => handleSelect(brand)}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
                  brand === value ? "bg-blue-100 font-medium" : ""
                }`}
              >
                {brand}
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-sm text-gray-400">Sin resultados</li>
          )}
        </ul>
      )}
    </div>
  );
}