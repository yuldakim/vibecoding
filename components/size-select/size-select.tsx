"use client";

import { useState, useTransition } from "react";
import { addSize } from "@/lib/sizes/actions";
import type { Size } from "@/lib/sizes/queries";

export function SizeSelect({
  sizes,
  onSelect,
  initialSelectedId,
}: {
  sizes: Size[];
  onSelect?: (size: Size) => void;
  /** 이미 고른 사이즈를 편집하러 돌아왔을 때 그 사이즈가 선택된 채로 보이게 한다. */
  initialSelectedId?: number | null;
}) {
  const [items, setItems] = useState(sizes);
  const [customName, setCustomName] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(initialSelectedId ?? null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function select(size: Size) {
    setSelectedId(size.id);
    onSelect?.(size);
  }

  function handleAddCustom() {
    const name = customName.trim();
    if (!name) return;
    setError("");
    startTransition(async () => {
      try {
        const size = await addSize(name);
        setItems((prev) => (prev.some((s) => s.id === size.id) ? prev : [...prev, size]));
        setCustomName("");
        select(size);
      } catch {
        setError("사이즈를 추가하지 못했습니다. 다시 시도해주세요.");
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {items.map((size) => (
          <button
            key={size.id}
            type="button"
            onClick={() => select(size)}
            className={`min-h-14 rounded-lg border-2 px-5 text-lg font-medium ${
              selectedId === size.id
                ? "border-blue-600 bg-blue-50"
                : "border-zinc-300 bg-white"
            }`}
          >
            {size.name}
          </button>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="목록에 없는 사이즈 직접 입력"
          className="h-14 flex-1 rounded-lg border-2 border-zinc-300 px-4 text-lg"
        />
        <button
          type="button"
          onClick={handleAddCustom}
          disabled={isPending || !customName.trim()}
          className="h-14 rounded-lg bg-zinc-900 px-6 text-lg text-white disabled:opacity-50"
        >
          추가
        </button>
      </div>
      {error && <p className="mt-2 text-lg text-red-600">{error}</p>}
    </div>
  );
}
