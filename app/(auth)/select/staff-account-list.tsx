"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { selectStaffAccount } from "@/app/(auth)/staff/actions";

const LAST_ACCOUNT_KEY = "lastStaffAccountId";

type Account = { id: number; name: string };

function subscribe() {
  return () => {};
}

function getLastAccountId(): number | null {
  const saved = window.localStorage.getItem(LAST_ACCOUNT_KEY);
  return saved ? Number(saved) : null;
}

/** 마지막으로 고른 계정을 기기별(localStorage)로 기억해 맨 위·강조 표시한다. */
export function StaffAccountList({ accounts }: { accounts: Account[] }) {
  // useSyncExternalStore로 localStorage를 읽는다 — effect+setState보다
  // 서버 스냅샷(null)과 클라이언트 값을 안전하게 구분해준다.
  const lastId = useSyncExternalStore(subscribe, getLastAccountId, () => null);

  const sorted = lastId
    ? [...accounts].sort((a, b) => Number(b.id === lastId) - Number(a.id === lastId))
    : accounts;

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      {sorted.map((account) => (
        <form
          key={account.id}
          action={selectStaffAccount}
          onSubmit={() => window.localStorage.setItem(LAST_ACCOUNT_KEY, String(account.id))}
        >
          <input type="hidden" name="staffId" value={account.id} />
          <Button
            type="submit"
            variant="primary"
            className={`w-full ${account.id === lastId ? "ring-2 ring-primary ring-offset-2" : ""}`}
          >
            {account.name}
          </Button>
        </form>
      ))}
    </div>
  );
}
