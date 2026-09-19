import { create } from "zustand";

/**
 * ringOpen lives here (not as BubbleLauncher-local state) so the overlay
 * panel's back button (AppShell) can reopen the bubble ring on its way back
 * to /map — "back to all the open bubbles", distinct from the X, which just
 * closes to a plain map with the ring collapsed.
 */
interface BubbleLauncherState {
  ringOpen: boolean;
  setRingOpen: (open: boolean) => void;
}

export const useBubbleLauncherStore = create<BubbleLauncherState>((set) => ({
  ringOpen: false,
  setRingOpen: (open) => set({ ringOpen: open }),
}));
