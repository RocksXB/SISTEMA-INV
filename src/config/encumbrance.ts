import type { EncumbranceStatus } from "../types";
export const ENCUMBRANCE_CONFIG: ReadonlyArray<{
  status: EncumbranceStatus;
  min: number;
  label: string;
  icon: string;
}> = [
  { status: "overloaded", min: 100, label: "Sobrecarga", icon: "!" },
  { status: "heavy", min: 75, label: "Pesado", icon: "▲" },
  { status: "loaded", min: 50, label: "Carregado", icon: "◆" },
  { status: "normal", min: 0, label: "Normal", icon: "✓" },
];
