# DB 스키마 설계 (T-004)

> SSOT는 이 문서다. T-005~T-012 마이그레이션은 여기 정의된 테이블·컬럼·제약만 만든다.
> 절 번호(§)는 `설계.md` 기준.

## ERD (텍스트)

```
factory_settings (단일 행, FK 없음)
staff_accounts (FK 없음)

clients ─┬─< items ─< item_aliases
         │      └─ merged_into_item_id ↺(자기참조, 체인)
         ├─< invoices ─< invoice_lines >─ items
         │                    └─ size_id > sizes
         ├─< monthly_prices ─< price_change_history
         │        item_id > items, size_id > sizes
         ├─< settlements ─< settlement_lines > invoice_lines
         └─< email_logs > settlements(선택)

audit_logs, notifications — 다른 테이블을 target_type/id 문자열로 참조(느슨한 FK, 대상이 여러 종류라 강한 FK 대신)
```

`─<` = 1:N, `>` = N:1, `↺` = 자기참조.

## 0. 공통 규칙

- 금액은 전부 `integer`(원). 소수 없음.
- PK는 `bigint generated always as identity`. 다중 공장(멀티테넌트)이 아니므로 순번 노출에 보안 문제 없음.
- **NOT NULL이 기본값이다.** 아래 컬럼 표에서 타입에 `null`이 붙지 않은 컬럼은 전부 `not null`이다. `null`이 붙은 것만 nullable.
- **모든 테이블은 만드는 즉시 RLS를 켠다**: `alter table <표> enable row level security;`. 정책은 하나도 만들지 않는다 — 정책 0개 = `anon`·`authenticated`는 아무 것도 못 보고 못 씀, `service_role`(서버 코드, `lib/supabase/server.ts`)만 통과한다. §4 배분표대로 각 마이그레이션이 자기가 만든 테이블의 RLS를 그 자리에서 켠다(T-016이 나중에 더 세밀한 정책을 추가할 수 있지만, "기본 차단"은 T-005부터 즉시 있어야 한다 — 그 전엔 `factory_settings.owner_password_hash`까지 브라우저 anon 키로 읽힌다).
- 상태 전이가 있는 컬럼(`status`)만 `text` + `check (... in (...))`로 값을 제한한다. Postgres native enum은 값 추가/제거가 번거로워 피한다.
- `kind`·`action`처럼 "종류"를 나열하는 컬럼은 테이블별로 다르다: 이 문서에 전체 목록이 이미 적혀 있으면 그 목록으로 `check`를 건다(`notifications.kind` 10종, `email_logs.kind` 3종). 목록이 아직 안 정해졌거나 화면 작업이 늘어날 때마다 새 값이 필요한 경우는 자유 `text`로 둔다(`audit_logs.action`).
- 시각 컬럼은 전부 `timestamptz`. `created_at`류(생성 시각을 뜻하는 컬럼)는 전부 `default now()` — insert할 때 매번 명시하지 않는다. 그 외 nullable 시각 컬럼(`approved_at`, `sent_at` 등)은 이벤트가 실제로 일어날 때 애플리케이션 코드가 채운다.
- "삭제 금지" 대상(원청·품목·직원·확정 송장·발송된 정산서·월별 단가)은 물리 삭제 컬럼이 없다. 상태 컬럼만 바뀐다.
- 로그인은 Supabase Auth를 쓰지 않는다. 직원은 `staff_accounts.id`를 서명 쿠키에 담아 role='staff'로, 사장님은 role='owner'로 서명 쿠키를 발급한다(T-013·T-014). 별도 `sessions` 테이블을 두지 않는다 — 쿠키가 곧 세션이고, 매 요청마다 `staff_accounts.is_active`만 재확인한다.

## 1. 테이블

### factory_settings (§23, §2 사장님 비밀번호)
단일 행(`id = 1` check 제약)만 허용. 인쇄물·엑셀에 찍히는 공장 정보와 사장님 비밀번호를 한 곳에 둔다 — 둘 다 "공장 전체에 하나뿐인 설정값"이라 테이블을 나누지 않는다.

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | int | `check (id = 1)` |
| factory_name, ceo_name, business_reg_no, address, phone | text | §23 |
| site_email_address | text | §19 사이트 전용 발송 주소 |
| owner_password_hash | text | bcrypt/argon2 해시. 평문 저장 안 함 |
| owner_login_fail_count | int default 0 | T-014 연속 실패 지연용 |
| owner_locked_until | timestamptz null | |
| updated_at | timestamptz | |

RLS 켠 뒤 정책 0개 — anon/authenticated로는 `owner_password_hash`를 포함해 이 행 전체가 안 보인다.

### staff_accounts (§2 직원)
| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | bigint | |
| name | text | |
| is_active | boolean default true | 사용 중지 = false. 삭제 안 함 |
| created_at | timestamptz | |

### clients — 원청 (§3)
| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | bigint | |
| name, contact_name, contact_email, phone, address | text | 담당자·납품장소 각 1개(컬럼 자체가 단일값이라 자동 보장) |
| auto_send_day | int | `check (auto_send_day between 1 and 31)`. 31일 없는 달 처리는 T-075 |
| owner_review_day | int | 사장님 확인 요청 기준일, 1~31 |
| email_subject_template, email_body_template | text | §19 자동 삽입 토큰은 문자열 치환으로 처리(스키마 무관) |
| is_active | boolean default true | 사용 중지. 삭제 안 함 |
| created_at | timestamptz | |

### items — 품목 (§4)
| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | bigint | |
| client_id | bigint FK → clients | 품목은 원청별 관리 |
| name | text | |
| is_hidden | boolean default false | 생산 종료 숨김. 삭제 안 함 |
| is_favorite | boolean default false | |
| last_used_at | timestamptz null | 최근 사용 우선 표시 |
| merged_into_item_id | bigint null FK → items | 합치기. 체인 2단 이상 가능 |
| created_at | timestamptz | |

제약:
- `unique (client_id, name) where merged_into_item_id is null` — 합쳐져서 더는 "현재 이름"이 아닌 품목은 이름 충돌 검사에서 뺀다.
- `check (merged_into_item_id is null or merged_into_item_id <> id)` — 자기 자신에게 합치는 1단 순환을 막는다.
- 인덱스 `merged_into_item_id` — 아래 두 재귀 함수가 이 컬럼으로 자식을 훑는다.

품목 합치기는 애플리케이션 코드(T-033)에서 항상 **체인 전체를 미리 조회해 순환 여부를 검사한 뒤** `merged_into_item_id`를 쓰게 한다. 그래도 재귀 함수 쪽에도 방어선을 둔다 — 2단 이상 순환(A→B→A)은 위 check로 못 막으므로 아래 두 함수 모두 `cycle`/깊이 제한을 건다.

최종 품목 조회용 함수(정방향: 자식 → 최종), T-007에서 생성:
```sql
create function final_item_id(p_item_id bigint) returns bigint
language sql stable as $$
  with recursive chain(id, merged_into) as (
    select id, merged_into_item_id from items where id = p_item_id
    union all
    select i.id, i.merged_into_item_id from items i
      join chain c on i.id = c.merged_into
  )
  cycle id set is_cycle using path
  select coalesce(
    (select id from chain where merged_into is null and not is_cycle limit 1),
    p_item_id
  );
$$;
```

같은 병합 그룹 조회용 함수(역방향: 최종 → 자신을 포함한 모든 하위 품목 id), 검색(T-028)이 쓴다:
```sql
create function item_ids_in_merge_group(p_item_id bigint) returns setof bigint
language sql stable as $$
  with recursive root as (
    select final_item_id(p_item_id) as id
  ), descendants(id) as (
    select id from root
    union all
    select i.id from items i
      join descendants d on i.merged_into_item_id = d.id
  )
  cycle id set is_cycle using path
  select id from descendants where not is_cycle;
$$;
```
검색(T-028)은 `invoice_lines.item_id in (select item_ids_in_merge_group(:검색으로_찾은_item_id))`로 옛 이름 송장까지 함께 찾는다. `final_item_id(id)`로 새 이름 → id, `item_ids_in_merge_group`으로 그 id가 흡수한 모든 옛 품목 id를 되짚는 두 단계다.

### item_aliases — 품목 이전 이름 이력 (§4)
| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | bigint | |
| item_id | bigint FK → items | |
| alias_name | text | 변경 전 이름 |
| changed_at | timestamptz | |
| reason | text null | |

과거 송장 조회는 `invoice_lines.item_name_snapshot`(아래)로 이미 보존된다. 이 표는 "언제 왜 이름이 바뀌었는지"를 보여주는 보조 기록이고, 옛 이름으로 지은 송장을 새 이름 검색에서 찾는 실제 경로는 `item_ids_in_merge_group()`(위)이다.

### sizes (§5)
| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | bigint | |
| name | text | `unique`, 앞뒤 공백 trim 후 저장 |
| is_default | boolean default false | 싱글·슈퍼싱글·퀸·킹 시드 |
| sort_order | int default 100 | |

품목-사이즈 제한 테이블은 만들지 않는다(§5 "미리 제한하지 않는다"). 수량 단위 컬럼도 없음(항상 `장`).

### invoices — 송장 (§6, §7, §8)
| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | bigint | |
| client_id | bigint FK → clients | |
| delivery_date | date | 기본값 오늘, 직원이 변경 가능 |
| invoice_no | int null unique | 확정 순간 `nextval('invoice_no_seq')`로 채움. 표시할 때만 6자리 0패딩 |
| status | text | `draft` \| `confirmed` \| `cancelled` |
| created_at | timestamptz | 작성 시각 |
| confirmed_at | timestamptz null | 확정(=번호 부여) 시각 |
| printed_at | timestamptz null | 최초 출력 시각 |
| last_reprinted_at | timestamptz null | 재출력 시각(가장 최근 1회). 매회 기록은 `audit_logs`가 담당 |
| cancelled_at | timestamptz null | |

제약(진리표로 확인됨 — `draft`는 번호 없음, `confirmed`·`cancelled`는 번호 있음, 셋 다 배타):
- `check (status <> 'draft' or invoice_no is null)` — 임시 송장에는 번호가 없다(§7).
- `check (status = 'draft' or invoice_no is not null)` — 확정·취소 송장은 항상 번호를 가진다(취소는 확정된 송장에만 일어나므로).

시퀀스: `create sequence invoice_no_seq;` — 취소돼도 절대 되돌리지 않는다(`nextval`만 쓰고 `setval`로 되돌리는 코드를 만들지 않는다).
임시 송장(`draft`)만 하드 삭제 가능(§24). `confirmed`·`cancelled`는 행을 지우지 않는다.
인덱스: `(client_id, delivery_date)` — 정산 생성(월별 집계)과 원청별 목록 조회에 씀.

### invoice_lines (§6)
| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | bigint | |
| invoice_id | bigint FK → invoices | |
| item_id | bigint FK → items | |
| item_name_snapshot | text | 작성 당시 품목명 — 절대 안 바뀜 |
| size_id | bigint FK → sizes | |
| quantity | int | `check (quantity > 0)` |
| note | text null | 품목별 비고. §11 예외 단가 사유도 여기(정산 단계에서 settlement_lines.note로 복사) |
| line_order | int | |

같은 `item_id`+`size_id`라도 `note`가 다르면 별도 행(§6) — 애초에 한 줄=한 행이라 자동 보장, 병합 로직을 두지 않는다.
인덱스: `invoice_id`(FK는 자동 색인되지 않으므로 명시), `item_id`.

### monthly_prices — 월별 봉제 단가 (§10, §12)
| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | bigint | |
| client_id | bigint FK → clients | |
| item_id | bigint FK → items | |
| size_id | bigint FK → sizes | |
| price_month | date | 해당 월 1일로 저장(예 `2026-07-01`) |
| unit_price | int null | null = 미정. 부가세 제외 공급가액 기준 |
| created_at, updated_at | timestamptz | |

`unique (client_id, item_id, size_id, price_month)`. 인덱스 `(client_id, price_month)` — 월별 단가표 화면(T-051)이 이 조합으로 조회.
RLS 켠 뒤 정책 0개 — 직원 세션(anon 키를 쓰는 브라우저 클라이언트)은 이 표를 절대 못 읽는다.

### price_change_history (§11 단가 수정 기록)
| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | bigint | |
| monthly_price_id | bigint FK → monthly_prices | |
| old_price, new_price | int null | |
| changed_by_role | text | `staff` \| `owner`(실제로는 owner만) |
| changed_at | timestamptz | |

이 표는 **월별 기본 단가**(`monthly_prices`) 변경만 기록한다. 정산 화면에서 특정 줄에만 주는 예외 단가(`settlement_lines.override_unit_price`) 변경은 여기 안 쓰고 `audit_logs`(`target_type='settlement_line'`, `action='price_override'`, `before`/`after`에 `{price}`)로 남긴다 — 대상이 단가표 자체가 아니라 정산 줄 하나뿐이라 범용 로그가 맞다.

### settlements — 정산서 (§13, §16, §21)
| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | bigint | |
| client_id | bigint FK → clients | |
| period_month | date | 정산 대상월 1일 |
| revision_no | int default 0 | 0=최초, 1·2…=수정본 |
| status | text | `draft`\|`pending_review`\|`approved`\|`needs_reapproval`\|`sent` (§16 흐름 그대로) |
| total_supply_amount, vat_amount, total_amount | int default 0 | 줄이 바뀔 때마다 다시 계산해 저장하는 캐시값. `sent_at`이 채워진 행은 이후 절대 재계산하지 않는다(발송본 고정, 수정하려면 새 revision) |
| approved_at | timestamptz null | 현재 승인 상태. `needs_reapproval`이 되면 null로 되돌아간다 |
| first_approved_at | timestamptz null | **최초로 승인된 시각. 한 번 채워지면 절대 안 지운다.** 이월 판정(T-065, §17)의 기준값 — "이 정산서가 승인된 적이 있는가"는 이걸로 묻는다 |
| send_scheduled_date | date null | 그 달 `clients.auto_send_day` 스냅샷 |
| sent_at | timestamptz null | |
| revision_notes | text null | §21 자동 생성된 변경 내역 문구. 사장님이 발송 전 수정 가능 |
| created_at, updated_at | timestamptz | |

`unique (client_id, period_month, revision_no)`. 발송된 행(`sent_at not null`)은 수정하지 않고 `revision_no + 1` 새 행을 만든다(§21).
승인 후 발송 전 내용이 바뀌면 애플리케이션 코드가 `status`를 `needs_reapproval`로, `approved_at`을 null로 되돌린다 — 단 `first_approved_at`은 그대로 둔다(스키마 트리거 아님 — 무엇이 "내용 변경"인지는 T-067에서 정의).
이월 판정(T-065)은 "이 `period_month`의 정산서 중 `first_approved_at is not null`인 게 있고, 그 시각보다 늦게 `confirmed_at`이 찍힌 그 달 송장이 있는가"로 묻는다. 승인이 나중에 취소돼도(`approved_at`만 null이 됨) 판정은 안 바뀐다. 같은 `period_month`에 revision이 여러 개면 각자 `first_approved_at`을 갖게 되므로, 판정에는 그중 `min(first_approved_at)`(=최초 revision이 처음 승인된 시각)을 쓴다 — 그 시점 이후 확정된 송장은 그때 이미 존재한 어떤 revision에도 못 들어갔을 것이기 때문.
인덱스: `(client_id, period_month)`.

### settlement_lines (§13, §14, §15, §17)
| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | bigint | |
| settlement_id | bigint FK → settlements | |
| invoice_line_id | bigint FK → invoice_lines | |
| applied_unit_price | int | 실제 계산에 쓴 단가 |
| override_unit_price | int null | 이 줄에만 다른 단가(§11). 있으면 `applied_unit_price`가 이 값과 같아야 함. 값이 바뀔 때마다 `audit_logs`에 전/후 기록(위 price_change_history 설명 참고) |
| supply_amount | int | `quantity × applied_unit_price` |
| is_carried_over | boolean default false | §17 전월 이월 |
| note | text null | 예외 단가 적용 이유 등 |

`unique (settlement_id, invoice_line_id)` — 같은 정산서(같은 revision)에 같은 송장 줄이 두 번 들어가는 걸 막는다(중복 클릭·재생성 방지).
인덱스: `invoice_line_id` — "이 송장 줄이 이미 어느 정산서에 들어갔는가"를 역조회할 때 씀.
**서로 다른 두 정산 기간에 같은 `invoice_line_id`가 들어가면 원청에 같은 납품을 두 번 청구하게 된다.** 이건 DB 유니크로 막을 수 없다(같은 줄이 수정 revision마다 정당하게 재등장하므로) — T-059·T-065가 줄을 넣기 전에 "이 `invoice_line_id`가 이미 다른 `period_month`의 취소되지 않은 정산서에 있는가"를 반드시 조회하게 한다.

정렬은 저장 컬럼이 아니라 조회 시 `invoices.delivery_date, invoices.invoice_no`로 정렬한다(§13). 품목별 중간합계 컬럼 없음(§13 "표시하지 않는다") — 화면·엑셀에서 전체 합계만 집계.
품목명·사이즈·수량은 `invoice_lines`를 조인해서 가져오고, 화면·엑셀 표시명은 `final_item_id(invoice_lines.item_id)`로 최종 품목명을 구한다(§4, §18).

부가세 계산은 **`settlements` 단위로 한 번**: `vat_amount = round(total_supply_amount * 0.1)`(Postgres `numeric` 연산, 원 단위 반올림). 애플리케이션(TypeScript) 쪽에서 같은 계산을 다시 할 때도 부동소수점(`* 0.1` 후 `Math.round`)이 아니라 정수 연산(`Math.round(total * 10) / 10` 금지 — `(total * 10 + 5) / 10 | 0`처럼 정수만 쓰거나 `Intl`/`decimal` 계열 라이브러리 사용)으로 맞춘다(`lib/settlements/calc.ts`, T-092에서 테스트). `settlement_lines`마다 부가세를 계산해 더하지 않는다(도메인 불변식 §14).

### audit_logs (§8 변경 전후 기록)
| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | bigint | |
| target_type | text | 예: `invoice`, `settlement`, `settlement_line` |
| target_id | bigint | |
| action | text | 자유 text — 화면 작업이 늘어날 때마다 새 값이 추가될 수 있어 check로 안 막음. 예: `reprint`, `edit_before_confirm`, `price_override` |
| before, after | jsonb null | |
| actor_role | text | `staff` \| `owner` — 개인 식별값 저장 안 함(§26) |
| created_at | timestamptz | |

### email_logs (§19, §20)
| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | bigint | |
| client_id | bigint FK → clients | |
| settlement_id | bigint null FK → settlements | 정산 관련 발송일 때만 |
| kind | text | `check in ('price_check_request','settlement_final','settlement_revision')`(§19가 명시한 3종, 고정) |
| subject, body | text | 실제로 발송한 제목·본문(사장님이 발송 직전 수정한 최종본) — 템플릿이 아니라 이 값으로 재발송(§20)하고, 수정 정산서 비교 문구 작성 시 이전 발송분과 대조 |
| file_name | text | |
| success | boolean | |
| failure_reason | text null | |
| created_at | timestamptz | |
| resolved_at | timestamptz null | 재발송 성공 시 채움(§20 알림 자동 해제) |

### notifications (§22)
| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | bigint | |
| kind | text | 아래 10종 중 하나로 `check` 제약 |
| target_role | text | `staff`\|`owner`\|`both` |
| ref_type, ref_id | text null, bigint null | 관련 레코드(선택) |
| is_resolved | boolean default false | |
| created_at | timestamptz | |
| resolved_at | timestamptz null | 해제 시각. 생성 시점엔 항상 비어 있음 |

`kind` 허용값(§22 그대로, 접두사로 대상 구분):
- 사장님: `owner_price_missing`, `owner_price_check_request_needed`, `owner_final_review_needed`, `owner_approved_awaiting_send`, `owner_send_date_passed`, `owner_email_failed`, `owner_revision_review_needed`
- 직원: `staff_owner_review_needed`, `staff_auto_send_upcoming`, `staff_send_failed`

## 2. 권한 경계 (T-016에서 구현, 여기서는 대상만 확정)

**모든 테이블이 기본적으로 anon/authenticated에게 닫혀 있다**(§0의 "RLS 즉시 켜기" 규칙). 그중에서도 돈이 보이는 테이블 — `monthly_prices`, `price_change_history`, `settlements`, `settlement_lines` — 은 이후에도 직원용 정책을 아예 추가하지 않는다(사장님 화면도 서버 코드가 `service_role`로 읽으므로 RLS 정책 자체가 필요 없다 — 정책 0개가 최종 상태).
서버 코드는 전부 `service_role`(`lib/supabase/server.ts`)을 쓰므로 RLS는 "브라우저에서 anon 키로 직접 찔러보는 경로"만 막는다. 직원 세션의 금액 비노출은 **RLS가 아니라 응답 DTO**가 책임진다 — 서버 액션·API 라우트가 직원 role일 때 금액 필드를 응답에서 제거한다(화면 숨김이 아니라 응답 자체에서 제외, T-016 작업 범위).

## 3. 설계.md 절 매핑

| 절 | 테이블 |
| --- | --- |
| §1 | (기능 없음 — 목적 서술) |
| §2 | staff_accounts, factory_settings(owner_password_hash) |
| §3 | clients |
| §4 | items, item_aliases, `final_item_id()`, `item_ids_in_merge_group()` |
| §5 | sizes |
| §6, §7, §8 | invoices, invoice_lines, audit_logs |
| §9 | (기능 없음 — 의도적 제외) |
| §10, §11, §12 | monthly_prices, price_change_history |
| §13, §14, §15 | settlements, settlement_lines |
| §16, §21 | settlements(status, revision_no, first_approved_at) |
| §17 | settlement_lines.is_carried_over, settlements.first_approved_at |
| §18 | settlement_lines + final_item_id() |
| §19, §20 | email_logs |
| §22 | notifications |
| §23 | factory_settings |
| §24 | 전 테이블의 소프트 상태 컬럼(is_active/is_hidden/status) + 전 테이블 RLS 기본 차단 |
| §25 | (기능 없음 — 화면 목록, T-017 이후 UI 작업이 담당) |
| §26 | (기능 없음 — 1차 제외 목록, 해당 테이블을 만들지 않음이 곧 반영) |

## 4. 마이그레이션 파일 배분 (T-005~T-012)

각 행은 "이 테이블을 만들고 그 자리에서 RLS를 켠다"까지 포함한다.

| 작업 | 테이블 |
| --- | --- |
| T-005 | factory_settings, staff_accounts |
| T-006 | clients |
| T-007 | items, item_aliases, `final_item_id()`, `item_ids_in_merge_group()` |
| T-008 | sizes |
| T-009 | invoices, invoice_lines, invoice_no_seq |
| T-010 | monthly_prices, price_change_history |
| T-011 | settlements, settlement_lines |
| T-012 | audit_logs, email_logs, notifications |
