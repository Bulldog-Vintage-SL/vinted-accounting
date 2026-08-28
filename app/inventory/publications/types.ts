/*
  Tipo de publicacion (BD)
*/

export type Publication = {
    id: string;
    platform: string;
    status: string | null;
    price: number | null;
    sync_status: string | null;
    external_id: string;
    last_sync: string | null;
    listing: {
        title: string;
        photo_url: string[]
    } | null;
    listing_id?: string;
    publication_url: string | null;
    account_id: string;
};
