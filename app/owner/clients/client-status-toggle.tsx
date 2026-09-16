"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { toggleClientActive } from "./actions";

/** 목록 행에 붙는 사용 중지/재사용 버튼. 중지는 되돌리기 쉬운 조작이 아니니 확인창을 거친다. */
export function ClientStatusToggle({
  id,
  name,
  isActive,
}: {
  id: number;
  name: string;
  isActive: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (isActive) {
    return (
      <>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          사용 중지
        </Button>
        <Dialog open={open} onClose={() => setOpen(false)} title="원청 사용 중지">
          <p className="mb-4">
            {name}을 사용 중지할까요? 과거 송장·정산 기록은 그대로 남고, 언제든 다시 사용할 수
            있습니다.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await toggleClientActive(id, false);
                setOpen(false);
              }}
            >
              사용 중지
            </Button>
          </div>
        </Dialog>
      </>
    );
  }

  return (
    <Button variant="secondary" onClick={() => toggleClientActive(id, true)}>
      재사용
    </Button>
  );
}
