"use client";

import { useState, useEffect, type ReactNode } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";

/**
 * CommandPalette — Cmd+K / Ctrl+K para navegación rápida en admin.
 *
 * Uso:
 *   <CommandPalette items={[
 *     { label: 'Cotizaciones arriendo', href: '/admin/cotizaciones-arriendo', keywords: ['arriendo', 'cotizar'] },
 *     { label: 'F29 SII', href: '/admin/sii', keywords: ['iva', 'tributario'] },
 *   ]} />
 *
 * El usuario presiona Cmd+K (Mac) o Ctrl+K (Win/Linux) para abrirlo.
 */

export interface CommandItem {
  label: string;
  href: string;
  keywords?: string[];
  group?: string;
  icon?: ReactNode;
}

interface Props {
  items: CommandItem[];
}

export default function CommandPalette({ items }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Cmd+K / Ctrl+K binding
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  function goto(item: CommandItem) {
    setOpen(false);
    router.push(item.href);
  }

  // Group items
  const groups = items.reduce<Record<string, CommandItem[]>>((acc, item) => {
    const g = item.group || "General";
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {});

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 bg-white text-gray-700 border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold shadow-lg hover:shadow-xl flex items-center gap-2"
        aria-label="Abrir command palette"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">⌘K</kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-20 px-4"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[60vh] overflow-hidden border border-gray-200"
      >
        <Command className="flex flex-col h-full">
          <div className="border-b border-gray-200 p-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <Command.Input
              autoFocus
              placeholder="Buscar página..."
              className="flex-1 outline-none text-sm"
            />
            <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] text-gray-500">ESC</kbd>
          </div>

          <Command.List className="flex-1 overflow-y-auto p-2">
            <Command.Empty className="text-sm text-gray-500 p-4 text-center">
              No se encontraron resultados
            </Command.Empty>
            {Object.entries(groups).map(([group, groupItems]) => (
              <Command.Group key={group} heading={group} className="text-xs text-gray-500 px-2 py-1 font-semibold">
                {groupItems.map((item) => (
                  <Command.Item
                    key={item.href}
                    value={`${item.label} ${(item.keywords || []).join(" ")}`}
                    onSelect={() => goto(item)}
                    className="flex items-center gap-2 px-2 py-2 rounded cursor-pointer hover:bg-gray-100 text-sm aria-selected:bg-orange-50 aria-selected:text-orange-700"
                  >
                    {item.icon && <span className="w-4 h-4 text-gray-400">{item.icon}</span>}
                    <span>{item.label}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>

          <div className="border-t border-gray-100 p-2 text-[10px] text-gray-400 flex justify-between">
            <span>↑↓ navegar · ↵ ir · esc cerrar</span>
            <span>⌘K toggle</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
