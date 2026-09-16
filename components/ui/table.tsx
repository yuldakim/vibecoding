import type { ReactNode } from "react";

/** 좁은 화면에서 표가 잘리는 대신 가로 스크롤 컨테이너 안에 담긴다(페이지 자체는 안 깨짐). */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-lg">{children}</table>
    </div>
  );
}

export function Th({ children }: { children: ReactNode }) {
  return (
    <th className="border-b border-border px-3 py-2 text-left font-semibold">{children}</th>
  );
}

export function Td({ children }: { children: ReactNode }) {
  return <td className="border-b border-border px-3 py-2">{children}</td>;
}
