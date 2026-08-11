"use client";

import { useEffect, useRef, useState } from "react";

type BrandSelectProps = {
  value: string;
  onChange: (brand: string) => void;
};

const NO_BRAND_OPTION = "Sin marca";

export default function BrandSelect({ value, onChange }: BrandSelectProps) {
  const [query, setQuery] = useState(value);
  const [brands, setBrands] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsLoading(true);
    fetch("/api/brands")
      .then(res => res.json())
      .then((data: string[]) => setBrands(data))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    setQuery(value);
  }, [value]);

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

  const filtered = brands.filter(b =>
    b.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (brand: string) => {
    onChange(brand);
    setQuery(brand);
    setIsOpen(false);
  };

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
        placeholder={isLoading ? "Cargando marcas..." : "Busca una marca"}
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

          {filtered.length > 0 ? (
            filtered.map(brand => (
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
            !isLoading && (
              <li className="px-3 py-2 text-sm text-gray-400">Sin resultados</li>
            )
          )}
        </ul>
      )}
    </div>
  );
}