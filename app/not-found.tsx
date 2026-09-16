import Link from "next/link";

// 아직 안 만든 화면으로 가는 링크(알림 바로가기, 원청 상세 등)가 여러 곳에
// 있다 — 그걸 누르면 Next 기본 영문 404로 막다른 길이 되던 문제를 막는다.
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">아직 준비되지 않은 화면입니다</h1>
      <Link href="/select" className="text-lg text-primary underline">
        처음으로 돌아가기
      </Link>
    </main>
  );
}
