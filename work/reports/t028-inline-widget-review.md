# 합성 Chat 위젯 원문 확인·검사

2026-10-20 (Asia/Seoul). 기준 HEAD
`9979e7c49bfc45b14dd186911c4db43da9411736` 위의 미커밋 변경.
T-028의 소유자 승인 범위에 따른 합성 전용 구현이다. Canon 변경,
Git 원격 갱신, 실제 DB·OAuth·유료 API 호출은 수행하지 않았다.

**2026-10-20 판정: 구현·로컬 회귀 PASS / 실제 Chat 버튼 왕복 미완료.**
**2026-10-21 추가 판정: 사용자 수용 시험으로 실제 합성 위젯 버튼 왕복 Gate SATISFIED.**

## 구현

- 공유 합성 hub의 새 Chat 프롬프트를 `review_synthetic_answer`로 연결했다.
  모델이 전달한 선택 답변·고정 Canon을 위젯 전용 `_meta`에 담는다.
- 위젯은 Canon과 Submission digest를 독립 계산하고 원문을 textContent로
  표시한다. 대화 전체를 읽거나 원래 Chat과 자동 비교하지 않는다.
- 원문 확인 체크 후 사용자 버튼 클릭만 `verify_synthetic_review`를 실행한다.
  새 답변·확인 변경은 이전 결과를 무효화하고, 늦은 응답은 버린다.
  동일 메타데이터 재전달은 상태를 초기화하지 않는다.
- 검사 도구는 app-only routing이지만 인증·동의 증명이 아니다. 공개 합성
  데이터만 받으며 SDK 직접 호출도 가능하다. 실제 Handoff 권한으로 재사용 금지.
- 답변을 URL, local/session storage, widget state, Hermeneus DB에 넣지 않는다.
  ChatGPT의 대화·도구 기록 보관까지 비영속이라고 주장하지 않는다.
- 의미 검증 제공자는 NOT_CONNECTED. 구조·고정 버전·인용 표시만 확인하며
  Canon 정합성·실질 주장 coverage를 판정하지 않는다. 결과는 항상
  INDETERMINATE, semantic verification 미실행이다.

## 회귀 검증

Node 22.23.3. 전체 Vitest **27파일 180개 PASS**. `tsc --noEmit`,
Governance checker, `git diff --check` PASS. 첫 샌드박스 시험의 루프백
EACCES는 권한 범위 내 재실행으로 해소했고 코드 실패로 간주하지 않았다.

외부 네트워크를 끊은 임시 Playwright Docker에서 전체 브라우저
**21개 PASS**. 이후 동일 메타데이터 재전달 처리 수정 후 위젯 집중
**6개 PASS**, 단위 **4개 PASS**, 타입 검사 PASS. HTML/스크립트 주입,
잘못된 packet/digest, 모델 consent/history 추가, 새 답변에 늦은 결과 붙이기,
호스트 실패, 거짓 ALIGNED, bridge 초기화 실패를 검증했다.

내부 적대적 검토에서 반복 host metadata가 확인/결과를 초기화할 수 있는
문제를 발견해 중복 처리를 막았다. 호스트 렌더링 장애의 확정 원인이라고
주장하지 않는다. 내부 검토는 제3자 독립 보증이 아니다.

## 별도 합성 배포

기존 CarlosLab `hermeneus-mcp-synthetic` 프로젝트만 갱신했다.
최종 READY `dpl_42bEgCrvU3s8FzLVJ6FduskFZe7e`, Node22 / icn1.
Immutable: `https://hermeneus-mcp-synthetic-3z9w7itru-carloslab.vercel.app`.
기존 두 alias 유지. 세 파일 `api/mcp.js`, `package.json`, `vercel.json`만 업로드.
키·환경 파일·DB·로컬 권한 prototype은 업로드하지 않았다.

최종 artifact: `dist/synthetic-mcp-host-359c82e6-1751-47be-8476-1663220c1de3`.
bundle SHA256 `47d59831edf43239240a6e75daab4c868fa4bce275e317a8194324e64e2f9228`.
실제 SDK 직렬화로 bundle의 고정 Canon 조회와 fail-closed 결과 PASS.
배포 alias의 5개 도구·위젯 review/inspect·잘못된 packet 거부는 라이브
합성 smoke로 확인했다. 마지막 URI 변경은 위젯 캐시 분리를 위한 v2다.

## 실제 일반 Chat 관찰

기존 개인 플러그인의 도구 새로 고침을 실행했다. 합성 공유 hub에서 새 일반
Chat을 열고 GPT-5.6 Sol / Medium과 개인 플러그인을 선택했다.
`open_synthetic_handoff` 조회 → 두 문장 생성 → 명시적으로 전체 답변 선택 →
`review_synthetic_answer` 호출을 확인했다.
대화: `https://chatgpt.com/c/6ad6b431-ce80-83ec-8f88-983e95669be6`.

첫 위젯 로딩 실패 후 재시도한 화면에서 원문 94자, Published 버전1,
Submission digest `sha256:b845bc7abd99b7eccd6c655b0648d65f81d817a55e91b912767d846250b31d6a`,
초기 비활성 검사 버튼과 원문 체크박스를 확인했다. 원문은 생성된 평문과
줄바꿈·인용이 일치했다. 그 뒤 브라우저 제어가 멈추어 검사 버튼을 통한
실제 결과 표시까지는 아직 관찰하지 못했다. 로컬 성공을 실제 Chat의
버튼 왕복 성공으로 대체하지 않는다.

수정 후 v2 리소스로 플러그인을 다시 새로 고침했다. 이후 새 일반 Chat도
`pending-home-input` 상태와 비활성 전송 버튼에 머물렀다. 콘솔에서
확정적인 원인을 찾지 못했다. 초기 위젯 표시 실패·제어 중단을 애플리케이션
결함 또는 호스트 내부 결함 중 하나로 단정하지 않는다. 최종 v2의 실제
체크박스 → 검사 버튼 → 화면 결과 Gate는 **미통과**로 남는다.

배포된 hub 화면 증거: `dist/t028-inline-hub-deployed.jpg`.
이는 안내 화면 증거이며 실제 Chat 버튼 검증 성공을 뜻하지 않는다.

호스트의 기존 CSP 꺼짐 배지는 변경하지 않았다. 보호 설정·sandbox·확장
프로그램 권한을 완화하지 않았고, 강화된 CSP에서 통과했다고 주장하지 않는다.

## 남은 제품 경계

실제 공유별 OAuth/위임, 취소·삭제의 실시간 재검사, 분산 일회성 metadata,
만료 정리, 사용자별 제한·유료 verifier와 전송 동의 연결은 후속 작업이다.
앞서 승인된 정책을 재승인 대상으로 돌리지 않는다. 실제 제품 활성화 전
정식 권위 기록과 구현·검증이 필요하며 T-028은 IN_PROGRESS를 유지한다.

## 사용자 수용 시험 추가 증거 (2026-10-21, Asia/Seoul)

소유자가 직전 안내의 모든 단계가 정상 동작했다고 보고하고 검사 후 화면을
첨부했다. 이에 따라 고정 합성 Handoff의 새 일반 Chat 설명 → 선택 답변 표시
→ 위젯 원문 확인 → 사용자 검사 클릭 → 구조·버전 결과 표시 Gate를
사용자 수용 증거 기준 SATISFIED로 기록한다. 2026-10-20의 미관찰 기록은
당시 관찰로 보존한다.

첨부 화면에서 직접 확인되는 사항:
- 고정 두 문장, 줄바꿈 및 [HI-001]/[HI-002] 인용이 위젯 안에 표시된다.
- Submission digest는 sha256:b845bc7abd99b7eccd6c655b0648d65f81d817a55e91b912767d846250b31d6a.
  알려진 고정 packet identity와 평문 두 문장(94자, LF 한 개)에서 별도
  오프라인 계산한 예상 digest와 같다. 새 tool-result 원본을 수집한
  검증이라고 주장하지 않는다.
- 결과는 INDETERMINATE · 의미 검증 미실행이며 구조·고정 버전 확인 완료를
  표시한다. 의미 제공자가 연결되지 않아 Canon 정합성을 판정하지 않았다는
  한계도 표시된다.
- 검사 후 원문 확인 체크가 해제되고 검사 버튼이 비활성 상태다.
- 대화·도구 호출 기록이나 새 브라우저/서버 추적은 수집하지 않았다.
  잘린 스크린샷만으로 URL, 모델, 실제 배포 ID 또는 모든 런타임 부작용을
  독립 입증하지 않는다. 최초 화면·작업 순서의 성공은 소유자 보고에 근거한다.

증거 원본을 바이트 그대로 dist/t028-user-widget-roundtrip-2026-10-21.png에 보존:
SHA256 544be2a1c1ca2e9b2c065cfff07e50a7121732be4bf9c15c6c4ad416fd861022.
고정 공개 합성 데이터만 담긴 사용자 제공 시험 화면이다.

### 남은 UX 관찰

위젯 아래의 이미 생성된 ChatGPT 설명은 AWAITING_ORIGINAL_REVIEW와
“아직 검증이 수행되거나 성공한 상태는 아닙니다”라는 검사 전 문구를 유지한다.
위젯 안에는 검사 완료 결과가 표시되므로 두 표면의 최신 상태가 일치하지 않는다.
현재 구현은 위젯의 결과 DOM을 갱신하고, 최초 review 도구 결과는 검사 전 상태를
반환한다. 정적 Chat 설명과 위젯 실행 결과를 구분하는 후속 UX 보완 사항으로
기록한다. 의미 검증 성공이나 사용자 이해 인증으로 해석하지 않는다.

이번 변경은 로컬 Work 증거/체크포인트 기록뿐이다. 코드, Canon, Git 원격,
배포, DB, 플러그인 권한 및 유료 API는 변경·호출하지 않았다.
실제 Handoff 공유별 권한·철회/삭제·수명 처리와 의미 검증 연결의 제품 Gate는
이 합성 수용 시험으로 충족되지 않는다.
