export const EMAIL_TOKENS = ["업체명", "연도", "월", "파일명", "수정본여부"] as const;
export type EmailTemplateValues = Record<(typeof EMAIL_TOKENS)[number], string>;

export const DEFAULT_SUBJECT_TEMPLATE = "{{업체명}} {{연도}}년 {{월}}월 정산서{{수정본여부}}";
export const DEFAULT_BODY_TEMPLATE =
  "{{업체명}} 담당자님,\n\n{{연도}}년 {{월}}월 정산서를 보내드립니다.\n첨부파일: {{파일명}}\n\n감사합니다.";

/** 템플릿의 {{토큰}}을 실제 값으로 치환한다. 정의된 5종 토큰만 치환하고 나머지 텍스트는 그대로 둔다. */
export function substituteTemplate(template: string, values: EmailTemplateValues): string {
  // 치환값을 문자열로 바로 넘기면 가 "$&" 같은 특수 치환 패턴으로 해석될
  // 수 있다 — 함수로 넘겨서 항상 리터럴로 들어가게 한다.
  return EMAIL_TOKENS.reduce(
    (text, token) => text.replaceAll(`{{${token}}}`, () => values[token]),
    template,
  );
}

/** 저장된 값이 비어 있으면(사장님이 한 번도 안 고쳤으면) 기본 템플릿을 쓴다. */
export function resolveSubjectTemplate(saved: string): string {
  return saved || DEFAULT_SUBJECT_TEMPLATE;
}
export function resolveBodyTemplate(saved: string): string {
  return saved || DEFAULT_BODY_TEMPLATE;
}
