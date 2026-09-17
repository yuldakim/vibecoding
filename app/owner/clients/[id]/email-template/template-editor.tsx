"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EMAIL_TOKENS, substituteTemplate, type EmailTemplateValues } from "@/lib/email/template";
import { updateEmailTemplate } from "./actions";

const SAMPLE_VALUES: EmailTemplateValues = {
  업체명: "이불나라",
  연도: "2026",
  월: "9",
  파일명: "이불나라_2026년09월_정산서.xlsx",
  수정본여부: "",
};

export function TemplateEditor({
  clientId,
  initialSubject,
  initialBody,
}: {
  clientId: number;
  initialSubject: string;
  initialBody: string;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState<"subject" | "body">("body");

  function insertToken(token: string) {
    const text = `{{${token}}}`;
    if (focused === "subject" && subjectRef.current) {
      const el = subjectRef.current;
      const pos = el.selectionStart ?? subject.length;
      const next = subject.slice(0, pos) + text + subject.slice(pos);
      setSubject(next);
    } else if (bodyRef.current) {
      const el = bodyRef.current;
      const pos = el.selectionStart ?? body.length;
      const next = body.slice(0, pos) + text + body.slice(pos);
      setBody(next);
    }
  }

  return (
    <form action={updateEmailTemplate} className="flex max-w-2xl flex-col gap-4">
      <input type="hidden" name="id" value={clientId} />

      <div className="flex flex-wrap gap-2">
        {EMAIL_TOKENS.map((token) => (
          <Button key={token} type="button" variant="secondary" onClick={() => insertToken(token)}>
            {`{{${token}}}`}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="subject" className="text-lg">
          제목
        </label>
        <input
          id="subject"
          name="subject"
          ref={subjectRef}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onFocus={() => setFocused("subject")}
          className="h-14 w-full rounded-lg border border-border px-4 text-lg"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="body" className="text-lg">
          본문
        </label>
        <textarea
          id="body"
          name="body"
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onFocus={() => setFocused("body")}
          rows={8}
          className="w-full rounded-lg border border-border px-4 py-2 text-lg"
        />
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
        <p className="text-lg font-semibold">미리보기 (샘플 값 기준)</p>
        <p className="text-lg">{substituteTemplate(subject, SAMPLE_VALUES)}</p>
        <p className="whitespace-pre-wrap text-lg">{substituteTemplate(body, SAMPLE_VALUES)}</p>
      </div>

      <Button type="submit">저장</Button>
    </form>
  );
}
