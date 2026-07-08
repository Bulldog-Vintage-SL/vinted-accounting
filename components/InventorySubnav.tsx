"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { name: "Productos", href: "/inventory/listings" },
  { name: "Publicaciones", href: "/inventory/publications" },
];

export default function InventorySubnav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="border-b border-gray-200 bg-white px-4 lg:px-8">
      <nav className="flex gap-6 max-w-7xl mx-auto">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`py-4 text-sm font-medium border-b-2 transition-colors ${
              isActive(tab.href)
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab.name}
          </Link>
        ))}
      </nav>
    </div>
  );
}
