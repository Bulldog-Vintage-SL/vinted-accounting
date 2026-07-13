import { Loader2 } from "lucide-react";

interface PageLoaderProps {
  label?: string;
}

export function PageLoader({ label = "Cargando..." }: PageLoaderProps) {
  return (
    <div className="flex items-center justify-center gap-3 p-8 text-gray-500">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>{label}</span>
    </div>
  );
}
