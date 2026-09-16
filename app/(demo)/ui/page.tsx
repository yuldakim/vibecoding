"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Table, Th, Td } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";

const ROWS = [
  { item: "메이퀸 꽃 차렵이불", size: "퀸", qty: 20 },
  { item: "호텔라인 누빔패드", size: "킹", qty: 15 },
  { item: "로즈가든 극세사이불", size: "싱글", qty: 30 },
];

export default function UiDemoPage() {
  const [open, setOpen] = useState(false);

  return (
    <main className="flex flex-col gap-8 p-8">
      <h1 className="text-2xl font-bold">공통 컴포넌트 (데모)</h1>

      <section className="flex flex-wrap gap-3">
        <Button variant="primary">송장 만들기</Button>
        <Button variant="secondary">임시 저장</Button>
        <Button variant="danger">송장 취소</Button>
      </section>

      <section className="flex max-w-sm flex-col gap-4">
        <Input id="client-name" label="원청 이름" placeholder="예: 이불나라" />
        <NumberInput id="quantity" label="수량 (장)" placeholder="0" />
      </section>

      <section>
        <Table>
          <thead>
            <tr>
              <Th>품목명</Th>
              <Th>사이즈</Th>
              <Th>수량</Th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.item}>
                <Td>{row.item}</Td>
                <Td>{row.size}</Td>
                <Td>{row.qty}장</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>

      <section>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          정산서 보내기
        </Button>
        <Dialog open={open} onClose={() => setOpen(false)} title="정산서 보내기">
          <p className="mb-4">이 정산서를 지금 발송할까요?</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              발송
            </Button>
          </div>
        </Dialog>
      </section>
    </main>
  );
}
