import { verifyOwnerPassword } from "./actions";

// 에러 문구는 쿼리 파라미터 값 그대로 렌더하지 않는다 — 자유 텍스트를 그대로
// 보여주면 "/owner?error=..." 링크로 정상 페이지 위에 임의 문구를 띄울 수
// 있다. 코드만 쿼리로 받고 문구는 여기서 서버가 정한다.
const ERROR_MESSAGES: Record<string, string> = {
  wrong: "비밀번호가 틀렸습니다.",
  locked: "너무 많이 틀렸습니다. 잠시 후 다시 시도하세요.",
  no_settings: "설정을 불러오지 못했습니다.",
};

export default async function OwnerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-8">
      <h1 className="text-2xl font-bold">사장님 모드</h1>
      {message && <p className="text-lg text-red-600">{message}</p>}
      <form action={verifyOwnerPassword} className="flex w-full max-w-sm flex-col gap-3">
        <label htmlFor="password" className="text-lg">
          비밀번호
        </label>
        <input
          id="password"
          type="password"
          name="password"
          autoFocus
          className="h-14 w-full rounded-lg border border-zinc-300 px-4 text-lg"
        />
        <button
          type="submit"
          className="h-14 w-full rounded-lg bg-blue-600 text-lg font-semibold text-white hover:bg-blue-700"
        >
          입장
        </button>
      </form>
    </main>
  );
}
