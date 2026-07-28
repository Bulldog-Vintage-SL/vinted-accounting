/*
  Devolvemos la componente de formulario de creacion de un nuevo producto declarando que su funcion onSubmit
  llame a la funcion createListingFromForm del action.ts
*/

"use client";

import ItemForm from "@/app/inventory/listings/new_listing/components/ListingForm";
import { createListingFromForm } from "./action";
import { ListingForm } from "../types";
import { useToast } from "@/components/toast";
import { isRedirectError } from "next/dist/client/components/redirect-error";

export default function NewListingPage() {
  const { pushToast } = useToast();

  const handleSubmit = async (data: ListingForm) => {
    try {
      await createListingFromForm(data);
    } catch (error) {
      if (isRedirectError(error)) throw error;

      pushToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo crear el producto",
      });
    }
  };

  return (
    <ItemForm
      initialData={{
        title: "",
        description: "",
        condition: "good",
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
      onSubmit={handleSubmit}
    />
  );
}