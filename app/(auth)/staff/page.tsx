import { redirect } from "next/navigation";

// T-088에서 이 화면을 /select로 흡수했다(직원 목록 + 사장님 모드 버튼을
// 한 화면에서 보여주는 게 §25 "사용자 선택 화면" 요구사항이라서). 로직·조회는
// ./actions.ts에 남아 있고(다른 화면이 재사용), 여기는 옛 경로로 들어온
// 사람을 새 화면으로 보내기만 한다.
export default function StaffSelectRedirectPage() {
  redirect("/select");
}
