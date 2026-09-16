import { getSizes } from "@/lib/sizes/queries";
import { SizeSelect } from "@/components/size-select/size-select";

// 목록이 정적 프리렌더로 굳지 않게 한다 — addSize의 revalidatePath만으로는
// 다른 경로(T-037 송장 화면 등)에서 추가된 사이즈가 여기 안 반영된다.
export const dynamic = "force-dynamic";

export default async function SizesDemoPage() {
  const sizes = await getSizes();
  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-bold">사이즈 선택 (데모)</h1>
      <p className="mb-4 text-lg text-zinc-600">수량 단위는 항상 &apos;장&apos;입니다.</p>
      <SizeSelect sizes={sizes} />
    </main>
  );
}
