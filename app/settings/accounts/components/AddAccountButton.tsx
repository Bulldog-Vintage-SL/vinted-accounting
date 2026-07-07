"use client";

import { useState } from "react";
import AddAccountModal from "./AddAccountModal";

export default function AddAccountButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
      >
        Añadir cuenta
      </button>

      <AddAccountModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
