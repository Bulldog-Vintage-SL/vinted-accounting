/*
  Devolvemos la componente de formulario de creacion de un nuevo producto declarando que su funcion onSubmit
  llame a la funcion createListingFromForm del action.ts
*/

"use client";

import ItemForm from "@/app/inventory/listings/new_listing/components/ListingForm";
import { createListingFromForm } from "./action";

export default function NewListingPage() {
  return (
    <ItemForm
      initialData={{
        title: "",
        description: "",
        condition: "",
        price: "",
        photo_url: [],
        colors: [],
        attributes: {
          brand: "",
          size: "",
        },
        gender: null,
        item_type: "",
        stock: 1
      }}
      onSubmit={createListingFromForm}
    />
  );
}