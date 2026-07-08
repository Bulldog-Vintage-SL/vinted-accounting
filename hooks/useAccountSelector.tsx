"use client";

import { create } from "zustand";

export interface SelectedAccount {
  accountId: string;
  platform: string;
}

interface AccountSelectorState {
  open: boolean;
  action: null | ((accounts: SelectedAccount[]) => void);

  openSelector: (action: (accounts: SelectedAccount[]) => void) => void;
  closeSelector: () => void;
}

export const useAccountSelector = create<AccountSelectorState>((set) => ({
  open: false,
  action: null,

  openSelector: (action) => set({ open: true, action }),
  closeSelector: () => set({ open: false, action: null }),
}));