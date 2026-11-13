import { create } from 'zustand';

/** UI state of the app frame (panels opened from anywhere). */
export const useShell = create<{
  navOpen: boolean;
  commandOpen: boolean;
  assistantOpen: boolean;
  setNavOpen: (v: boolean) => void;
  setCommandOpen: (v: boolean) => void;
  setAssistantOpen: (v: boolean) => void;
}>((set) => ({
  navOpen: false,
  commandOpen: false,
  assistantOpen: false,
  setNavOpen: (navOpen) => set({ navOpen }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setAssistantOpen: (assistantOpen) => set({ assistantOpen }),
}));
