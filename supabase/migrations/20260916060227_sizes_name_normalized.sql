-- 공백류(제로폭 포함)·유니코드 정규화(NFC)·대소문자 차이만 있는 이름이
-- 서로 다른 행으로 중복 생성되는 것을 DB 제약으로 막는다. 앱 계층의
-- trim/대소문자 비교만으로는 동시 요청(TOCTOU)을 막지 못했다.
alter table sizes
  add column if not exists name_normalized text
  generated always as (lower(normalize(name, nfc))) stored;

create unique index if not exists sizes_name_normalized_key
  on sizes (name_normalized);
