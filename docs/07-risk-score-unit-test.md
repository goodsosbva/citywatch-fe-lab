# 7단계: 위험도 계산 + Vitest Unit Test/TDD

## 상세 해설서

테스트 코드와 위험도 계산 로직이 맞물리는 흐름은 아래 문서에 코드와 함께 정리했다.

```txt
docs/07-risk-score-code-walkthrough.md
docs/07-risk-score-test-explainer.md
```

## 1. 지금까지 한 것

6단계까지는 도시 안전 관제 시스템의 기본 사고 흐름을 만들었다.

```txt
관제 홈
→ 사고 목록
→ 사고 상세
→ 사고 상태 변경
→ 사고 등록
→ 등록 입력값 Zod 검증
→ REST API로 조회/등록/상태 변경
```

7단계 전까지는 사고의 `severity`, `status`, `affectedPeople`을 보여주기만 했다.
하지만 관제 시스템에서는 “어떤 사고를 먼저 볼 것인가”를 판단하는 위험도 계산 기준이 필요하다.

## 2. 이번에 구현한 것

이번 단계에서는 사고 위험도 계산과 Vitest 단위 테스트를 추가했다.

핵심 파일:

```txt
packages/api-types/src/index.ts
packages/api-types/test/risk-score.test.ts
packages/api-types/package.json
apps/web/app/incidents/page.tsx
apps/web/app/incidents/incident-detail-view.tsx
apps/web/app/incidents/incident-format.ts
```

추가한 도메인 타입/함수:

```txt
IncidentRiskLevel
IncidentRisk
IncidentRiskInput
calculateIncidentRisk(incident)
```

추가한 테스트 도구:

```txt
vitest
describe
it
expect
```

화면에 추가한 값:

```txt
사고 목록 카드: 위험도 배지 + 위험도 메타
사고 상세 헤더: 위험도 배지
사고 상세 정보: 위험도 항목
```

X-Ray 라벨:

```txt
feature/incident/CalculateRiskScore
packageName="packages/api-types"
stacks=["Vitest", "Unit Test", "Pure Function"]
```

## 3. 왜 이걸 했는지

관제 시스템에서 위험도는 실제 업무 우선순위 판단 기준이다.

```txt
사고 데이터
→ 위험도 계산
→ 목록 강조
→ 상세 판단
→ 이후 지도 마커 색상
→ 이후 실시간 알림 우선순위
```

프론트엔드 학습 증명 관점에서는 이 단계가 Unit Test/TDD 증명 지점이다.

여기서 중요한 판단은 다음이다.

```txt
위험도 계산은 React 컴포넌트 안에 넣지 않는다.
```

이유:

```txt
1. 계산은 UI 렌더링과 별개인 도메인 규칙이다.
2. 목록/상세/지도/실시간 화면에서 같은 규칙을 재사용해야 한다.
3. 컴포넌트 안에 넣으면 테스트가 UI 렌더링 테스트로 커진다.
4. 순수 함수로 분리하면 입력과 출력만으로 빠르게 검증할 수 있다.
```

그래서 `calculateIncidentRisk`는 `packages/api-types`에 둔다.

## 4. 어떻게 세팅했는지


### 4-0. 파일을 이렇게 나눈 이유

이번 단계에서 판단이 들어간 파일 배치는 다음 인과를 따른다.

```txt
packages/api-types/package.json
→ 위험도 계산 로직이 api-types 패키지에 있으므로, 그 테스트 실행 명령도 api-types 패키지가 소유한다.

packages/api-types/test/risk-score.test.ts
→ calculateIncidentRisk를 검증하는 Vitest 테스트이므로 구현 패키지 내부 test 폴더에 둔다.

packages/api-types/src/index.ts
→ 위험도 계산은 특정 화면 UI가 아니라 사고 도메인 규칙이므로 공유 타입 패키지에 둔다.

apps/web/app/incidents/page.tsx
→ 목록 화면은 여러 사고의 우선순위를 비교하는 곳이므로 위험도를 표시한다.

apps/web/app/incidents/incident-detail-view.tsx
→ 상세 화면은 상태 변경 후 위험도가 다시 계산되어야 하므로 같은 함수를 호출한다.

apps/web/app/incidents/incident-format.ts
→ 위험도 level의 한글 라벨과 Badge 색상은 UI 표현이므로 web 앱의 format 파일에 둔다.

package-lock.json
→ Vitest 설치로 생긴 의존성 트리를 재현 가능하게 고정한다.

docs/*
→ 코드만 보면 판단 근거가 사라지므로 학습/면접 설명을 문서로 남긴다.
```

핵심 원칙은 이렇다.

```txt
계산 규칙은 공유 도메인 패키지에 둔다.
테스트는 계산 규칙 소유 패키지에 둔다.
표시 라벨과 색상은 web UI 계층에 둔다.
실행 방법과 판단 근거는 docs에 남긴다.
```

### 4-1. Vitest 설치

파일:

```txt
packages/api-types/package.json
```

코드:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^4.1.10"
  }
}
```

현재는 `vitest run`으로 TypeScript 테스트 파일을 직접 실행한다.


### 4-2. Vitest 테스트 파일

파일:

```txt
packages/api-types/test/risk-score.test.ts
```

코드:

```ts
import { describe, expect, it } from "vitest";
import { calculateIncidentRisk, type IncidentRiskInput } from "../src/index";
```

해설:

```txt
describe → 테스트 그룹
it       → 개별 테스트 케이스
expect   → 실제 결과와 기대 결과 비교
```

테스트 대상은 `calculateIncidentRisk`다.

```txt
risk-score.test.ts
→ ../src/index에서 calculateIncidentRisk import
→ 테스트 입력 객체 전달
→ 반환된 risk.score / risk.level / risk.reasons 검증
```

### 4-3. 테스트 입력 타입 고정

코드:

```ts
const baseIncident = {
  affectedPeople: 0,
  category: "traffic",
  severity: "low",
  status: "reported",
} satisfies IncidentRiskInput;
```

`IncidentRiskInput`은 위험도 계산에 필요한 필드만 뽑은 타입이다.

```ts
export type IncidentRiskInput = Pick<
  Incident,
  "affectedPeople" | "category" | "severity" | "status"
>;
```

`satisfies IncidentRiskInput`을 붙인 이유:

```txt
baseIncident가 위험도 계산 입력 조건을 만족하는지 TypeScript가 검사한다.
잘못된 severity/status/category 값을 넣으면 테스트 코드 단계에서 잡힌다.
```

### 4-4. 위험도 계산 함수

파일:

```txt
packages/api-types/src/index.ts
```

핵심 코드:

```ts
export function calculateIncidentRisk(incident: IncidentRiskInput): IncidentRisk {
  const affectedPeople = Math.max(0, incident.affectedPeople);
  const score = clampRiskScore(
    severityRiskBase[incident.severity] +
      statusRiskModifier[incident.status] +
      categoryRiskModifier[incident.category] +
      getAffectedPeopleRisk(affectedPeople),
  );

  return {
    score,
    level: getIncidentRiskLevel(score),
    reasons: getIncidentRiskReasons(incident, affectedPeople),
  };
}
```

계산 순서:

```txt
severity 기본 점수
+ status 보정 점수
+ category 보정 점수
+ affectedPeople 보정 점수
→ 0~100으로 clamp
→ score 기준 level 계산
→ reasons 생성
```

## 5. 실제로 동작시키면 어떤 흐름인지

루트에서 실행:

```bash
npm run test
```

실제 흐름:

```txt
npm run test
→ npm run test --workspaces --if-present
→ @citywatch/api-types test script 실행
→ vitest run
→ packages/api-types/test/risk-score.test.ts 발견
→ Vitest가 TypeScript 테스트 파일 transform
→ ../src/index에서 calculateIncidentRisk import
→ describe 안의 it 3개 실행
→ expect로 결과 검증
```

api-types만 직접 실행:

```bash
npm --workspace @citywatch/api-types run test
```

화면 흐름:

```txt
/incidents
→ fetchIncidents()
→ incidents.map
→ IncidentListItem
→ calculateIncidentRisk(incident)
→ 위험도 배지 표시
```

상세 화면 흐름:

```txt
/incidents/[id]
→ fetchIncident(id)
→ incident state 저장
→ calculateIncidentRisk(incident)
→ 상세 헤더/상세 정보에 위험도 표시
```

상태 변경 시:

```txt
PATCH /api/incidents/[id]/status
→ updated incident 응답
→ setIncident(updated)
→ 재렌더링
→ calculateIncidentRisk(updated)
→ 바뀐 status 기준 위험도 재계산
```


### 5-1. 테스트한 부분이 실제로 타는 일련 흐름

```txt
npm run test
→ 루트 package.json의 npm run test --workspaces --if-present
→ @citywatch/api-types workspace의 test script 발견
→ packages/api-types/package.json의 vitest run 실행
→ Vitest가 packages/api-types/test/risk-score.test.ts 수집
→ 테스트 파일이 ../src/index에서 calculateIncidentRisk import
→ describe("calculateIncidentRisk") 그룹 실행
→ it 테스트 3개 실행
→ 각 it이 calculateIncidentRisk에 사고 입력 전달
→ calculateIncidentRisk가 score/level/reasons 계산
→ expect가 반환값을 기대값과 비교
→ 3개가 모두 맞으면 Tests 3 passed
```

이 흐름의 인과는 다음이다.

```txt
위험도 계산 로직은 packages/api-types에 있다.
→ 테스트도 api-types workspace에서 실행한다.

학습 앱에서 Vitest 경험을 보여줘야 한다.
→ node:test가 아니라 vitest run을 사용한다.

테스트 대상은 public 함수다.
→ risk-score.test.ts는 내부 helper가 아니라 calculateIncidentRisk를 import한다.

화면은 calculateIncidentRisk 결과를 표시한다.
→ 테스트가 통과하면 목록/상세가 사용하는 계산 규칙의 핵심 결과가 검증된다.
```


### 5-2. 하나의 테스트 기준으로 끝까지 보면

첫 번째 테스트 기준 흐름은 아래와 같다.

```txt
npm run test
→ root package.json의 workspace test 실행
→ packages/api-types/package.json의 vitest run 실행
→ risk-score.test.ts 수집
→ 첫 번째 it("marks critical active incidents as severe") 실행
→ calculateIncidentRisk({ critical, flood, in_progress, affectedPeople: 42 }) 호출
→ src/index.ts의 calculateIncidentRisk 구현 함수 진입
→ severityRiskBase["critical"] = 80
→ statusRiskModifier["in_progress"] = 10
→ categoryRiskModifier["flood"] = 8
→ getAffectedPeopleRisk(42) = 10
→ 원점수 108
→ clampRiskScore(108) = 100
→ getIncidentRiskLevel(100) = "severe"
→ reasons에 "critical severity" 포함
→ risk 반환
→ expect(risk).toMatchObject({ level: "severe", score: 100 }) 통과
→ expect(risk.reasons).toContain("critical severity") 통과
→ 첫 번째 it pass
```

이 흐름의 자세한 코드는 아래 문서에서 테스트 코드와 실제 구현 코드를 번갈아가며 설명한다.

```txt
docs/07-risk-score-code-walkthrough.md
```


### 5-3. false_alarm 테스트 기준: 테스트 코드 / 실제 코드 / UI 코드가 어떻게 맞물리는가

이 섹션은 아래 파일을 번갈아 보면서 읽어야 한다.

```txt
테스트 코드
→ packages/api-types/test/risk-score.test.ts

실제 계산 코드
→ packages/api-types/src/index.ts

목록 UI 코드
→ apps/web/app/incidents/page.tsx

상세 UI 코드
→ apps/web/app/incidents/incident-detail-view.tsx

위험도 한글 라벨/배지 톤 코드
→ apps/web/app/incidents/incident-format.ts
```

읽는 순서는 이것이다.

```txt
테스트가 calculateIncidentRisk에 입력을 넣는다.
→ 실제 계산 함수가 score와 level을 만든다.
→ expect가 그 반환 객체를 검증한다.
→ 목록/상세 UI는 같은 함수를 호출해서 같은 score와 level을 화면에 표시한다.
```

폐하가 지적한 두 번째 테스트는 이것이다.

테스트 코드:

```ts
it("lowers resolved false alarms to low risk", () => {
  const risk = calculateIncidentRisk({
    ...baseIncident,
    affectedPeople: 80,
    severity: "high",
    status: "false_alarm",
  });

  expect(risk).toMatchObject({
    level: "low",
    score: 28,
  });
});
```

이 테스트의 목적은 단순히 숫자 28을 맞히는 게 아니다.
이 테스트는 아래 규칙을 증명한다.

```txt
심각도 high인 사고라도 status가 false_alarm이면 위험도가 낮아져야 한다.
그리고 그 계산 결과를 UI가 사용하면 화면에는 낮은 위험도로 표시되어야 한다.
```

#### 5-3-1. 테스트 코드가 만드는 입력

테스트 코드:

```ts
const baseIncident = {
  affectedPeople: 0,
  category: "traffic",
  severity: "low",
  status: "reported",
} satisfies IncidentRiskInput;
```

테스트 코드:

```ts
const risk = calculateIncidentRisk({
  ...baseIncident,
  affectedPeople: 80,
  severity: "high",
  status: "false_alarm",
});
```

인과:

```txt
...baseIncident가 먼저 들어간다.
그 뒤 affectedPeople, severity, status가 덮어쓴다.
category는 덮어쓰지 않았으므로 baseIncident의 traffic이 유지된다.
```

따라서 실제로 `calculateIncidentRisk`에 들어가는 입력은 이것이다.

```ts
{
  affectedPeople: 80,
  category: "traffic",
  severity: "high",
  status: "false_alarm"
}
```

이 입력이 중요한 이유:

```txt
severity high
→ 원래라면 높은 위험도 쪽으로 올라갈 수 있다.

status false_alarm
→ 하지만 오인 신고이므로 위험도를 크게 낮춰야 한다.

affectedPeople 80
→ 영향 인원은 있지만 100명 이상은 아니므로 30명 이상 구간 점수를 받는다.

category traffic
→ 교통 사고 보정 점수를 받는다.
```

#### 5-3-2. 테스트 코드가 실제 구현 함수로 들어간다

테스트 코드:

```ts
const risk = calculateIncidentRisk({
  ...baseIncident,
  affectedPeople: 80,
  severity: "high",
  status: "false_alarm",
});
```

실제 구현 코드:

```ts
export function calculateIncidentRisk(incident: IncidentRiskInput): IncidentRisk {
  const affectedPeople = Math.max(0, incident.affectedPeople);
  const score = clampRiskScore(
    severityRiskBase[incident.severity] +
      statusRiskModifier[incident.status] +
      categoryRiskModifier[incident.category] +
      getAffectedPeopleRisk(affectedPeople),
  );

  return {
    score,
    level: getIncidentRiskLevel(score),
    reasons: getIncidentRiskReasons(incident, affectedPeople),
  };
}
```

인과:

```txt
테스트는 calculateIncidentRisk를 호출한다.
calculateIncidentRisk는 테스트 입력 객체를 incident 매개변수로 받는다.
이제 incident.severity/status/category/affectedPeople 값이 실제 점수 계산 코드에 대입된다.
```

이 시점의 `incident`는 이렇게 보면 된다.

```ts
incident = {
  affectedPeople: 80,
  category: "traffic",
  severity: "high",
  status: "false_alarm"
}
```

#### 5-3-3. 실제 코드에서 severity high가 60점으로 바뀐다

실제 구현 코드:

```ts
const severityRiskBase: Record<IncidentSeverity, number> = {
  low: 12,
  medium: 32,
  high: 60,
  critical: 80,
};
```

실제 계산 코드:

```ts
severityRiskBase[incident.severity]
```

테스트 입력 대입:

```txt
incident.severity = "high"
severityRiskBase["high"] = 60
```

인과:

```txt
테스트는 severity를 high로 넣었다.
실제 구현은 high를 60점으로 해석한다.
따라서 이 사고는 출발점이 60점이다.
```

#### 5-3-4. 실제 코드에서 status false_alarm이 -45점으로 바뀐다

실제 구현 코드:

```ts
const statusRiskModifier: Record<IncidentStatus, number> = {
  reported: 5,
  dispatching: 12,
  in_progress: 10,
  resolved: -25,
  false_alarm: -45,
};
```

실제 계산 코드:

```ts
statusRiskModifier[incident.status]
```

테스트 입력 대입:

```txt
incident.status = "false_alarm"
statusRiskModifier["false_alarm"] = -45
```

인과:

```txt
이 테스트의 핵심은 바로 이 줄이다.
status가 false_alarm이면 위험도를 -45점 낮춘다.
그래서 high 사고라도 실제 관제 우선순위에서는 낮은 위험도로 내려갈 수 있다.
```

이 부분이 깨지면 UI도 같이 흔들린다.

```txt
false_alarm 보정이 약해짐
→ risk.score가 높아짐
→ 목록 UI가 오인 신고를 높은 위험도로 표시할 수 있음
→ 관제 우선순위 판단이 틀어짐
```

#### 5-3-5. 실제 코드에서 category traffic이 3점으로 바뀐다

실제 구현 코드:

```ts
const categoryRiskModifier: Record<IncidentCategory, number> = {
  fire: 8,
  traffic: 3,
  flood: 8,
  crime: 8,
  facility: 4,
  medical: 7,
  weather: 6,
};
```

실제 계산 코드:

```ts
categoryRiskModifier[incident.category]
```

테스트 입력 대입:

```txt
incident.category = "traffic"
categoryRiskModifier["traffic"] = 3
```

인과:

```txt
테스트 코드에는 category를 직접 쓰지 않았다.
하지만 baseIncident에 category: "traffic"이 있으므로 traffic이 유지된다.
실제 구현은 traffic을 3점으로 계산한다.
```

#### 5-3-6. 실제 코드에서 affectedPeople 80이 10점으로 바뀐다

실제 구현 코드:

```ts
function getAffectedPeopleRisk(affectedPeople: number) {
  if (affectedPeople >= 1000) return 25;
  if (affectedPeople >= 100) return 18;
  if (affectedPeople >= 30) return 10;
  if (affectedPeople >= 1) return 5;
  return 0;
}
```

실제 계산 코드:

```ts
getAffectedPeopleRisk(affectedPeople)
```

테스트 입력 대입:

```txt
affectedPeople = 80
80 >= 1000 ? false
80 >= 100 ? false
80 >= 30 ? true
return 10
```

인과:

```txt
80명은 영향 인원이 있는 사고다.
하지만 100명 이상 구간은 아니다.
따라서 18점이 아니라 10점을 받는다.
```

#### 5-3-7. 실제 코드가 최종 score 28을 만든다

실제 계산 코드:

```ts
const score = clampRiskScore(
  severityRiskBase[incident.severity] +
    statusRiskModifier[incident.status] +
    categoryRiskModifier[incident.category] +
    getAffectedPeopleRisk(affectedPeople),
);
```

대입 결과:

```txt
severityRiskBase["high"] = 60
statusRiskModifier["false_alarm"] = -45
categoryRiskModifier["traffic"] = 3
getAffectedPeopleRisk(80) = 10
```

합산:

```txt
60 + (-45) + 3 + 10 = 28
```

실제 구현 코드:

```ts
function clampRiskScore(score: number) {
  return Math.min(100, Math.max(0, Math.round(score)));
}
```

대입:

```txt
clampRiskScore(28) = 28
```

인과:

```txt
false_alarm의 -45 보정이 적용되었기 때문에 최종 score가 28까지 내려간다.
이 테스트는 이 감점 규칙이 실제 계산 결과에 반영되는지 확인한다.
```

#### 5-3-8. 실제 코드가 level low를 만든다

실제 구현 코드:

```ts
function getIncidentRiskLevel(score: number): IncidentRiskLevel {
  if (score >= 80) return "severe";
  if (score >= 60) return "elevated";
  if (score >= 35) return "guarded";
  return "low";
}
```

대입:

```txt
score = 28
28 >= 80 ? false
28 >= 60 ? false
28 >= 35 ? false
return "low"
```

인과:

```txt
score가 35 미만이면 low다.
false_alarm 보정 때문에 score가 28이 되었으므로 level은 low가 된다.
```

#### 5-3-9. 테스트 코드의 expect는 실제 반환값을 본다

테스트 코드:

```ts
expect(risk).toMatchObject({
  level: "low",
  score: 28,
});
```

실제 구현이 반환한 값은 개념적으로 이것이다.

```ts
risk = {
  score: 28,
  level: "low",
  reasons: [
    "high severity",
    "false_alarm status",
    "traffic category",
    "80 affected people"
  ]
}
```

`expect`가 보는 것:

```txt
risk.level이 "low"인가?
→ yes

risk.score가 28인가?
→ yes
```

그래서 이 테스트는 통과한다.

```txt
이 테스트가 직접 증명하는 것:
false_alarm이 들어간 위험도 계산 결과는 low / 28이다.
```

하지만 여기서 중요한 한계도 있다.

```txt
이 테스트는 DOM을 보지 않는다.
이 테스트는 화면에 "위험도 28"이 찍혔는지 직접 보지 않는다.
```

즉 현재 테스트는 UI 테스트가 아니라 도메인 계산 테스트다.
다만 UI가 같은 `calculateIncidentRisk`를 호출하기 때문에 UI 표시 값의 계산 근거를 검증한다.

#### 5-3-10. 이 risk가 목록 UI에서 어떻게 보이는가

목록 UI 실제 코드:

```tsx
function IncidentListItem({
  incident,
  xray,
}: {
  incident: Incident;
  xray: boolean;
}) {
  const risk = calculateIncidentRisk(incident);
```

인과:

```txt
목록 카드가 incident를 받는다.
그 incident가 false_alarm/high/traffic/80 조건이면 calculateIncidentRisk는 low / 28을 반환한다.
```

목록 UI 실제 코드:

```tsx
<Badge tone={getRiskTone(risk.level)}>위험도 {risk.score}</Badge>
```

`risk` 대입:

```txt
risk.level = "low"
risk.score = 28
```

화면에 보이는 결과:

```txt
위험도 28
```

Badge tone 계산 실제 코드:

```ts
export function getRiskTone(level: IncidentRiskLevel) {
  if (level === "severe") return "danger";
  if (level === "elevated") return "warning";
  if (level === "guarded") return "info";
  return "success";
}
```

대입:

```txt
getRiskTone("low")
→ success
```

인과:

```txt
false_alarm 테스트가 low를 증명한다.
목록 UI는 low를 getRiskTone에 넣는다.
getRiskTone("low")는 success를 반환한다.
따라서 목록 UI의 위험도 배지는 낮은 위험도 톤으로 보인다.
```

목록 UI 메타 코드:

```tsx
<MetaItem
  label="위험도"
  value={`${incidentRiskLevelLabels[risk.level]} ${risk.score}`}
/>
```

라벨 변환 실제 코드:

```ts
export const incidentRiskLevelLabels: Record<IncidentRiskLevel, string> = {
  low: "낮음",
  guarded: "주의",
  elevated: "높음",
  severe: "심각",
};
```

대입:

```txt
incidentRiskLevelLabels["low"] = "낮음"
risk.score = 28
```

목록 메타에 보이는 결과:

```txt
위험도: 낮음 28
```

정리:

```txt
테스트 입력 false_alarm/high/traffic/80
→ calculateIncidentRisk 결과 low / 28
→ 목록 Badge: 위험도 28
→ 목록 MetaItem: 위험도 낮음 28
→ Badge tone: success
```

#### 5-3-11. 이 risk가 상세 UI에서 어떻게 보이는가

상세 UI 실제 코드:

```tsx
const risk = incident ? calculateIncidentRisk(incident) : undefined;
```

인과:

```txt
상세 화면은 incident가 로드된 뒤에만 위험도를 계산한다.
그 incident가 false_alarm/high/traffic/80 조건이면 risk는 low / 28이다.
```

상세 UI 실제 코드:

```tsx
{risk ? (
  <XRayBox enabled={xray} label="feature/incident/CalculateRiskScore" packageName="packages/api-types" stacks={["Unit Test", "Pure Function"]}>
    <Badge tone={getRiskTone(risk.level)}>위험도 {risk.score}</Badge>
  </XRayBox>
) : null}
```

대입:

```txt
risk.level = "low"
risk.score = 28
getRiskTone("low") = "success"
```

상세 헤더에 보이는 결과:

```txt
위험도 28
```

상세 정보 코드:

```tsx
{risk ? <DetailItem label="위험도" value={`${incidentRiskLevelLabels[risk.level]} ${risk.score}`} /> : null}
```

대입:

```txt
incidentRiskLevelLabels["low"] = "낮음"
risk.score = 28
```

상세 정보에 보이는 결과:

```txt
위험도: 낮음 28
```

#### 5-3-12. 상태 변경 UI와 이 테스트가 어떻게 맞물리는가

상세 화면 상태 변경 코드:

```tsx
const updated = await changeIncidentStatus({ incidentId: incident.id, status: selectedStatus });
setIncident(updated);
setSelectedStatus(updated.status);
```

상태 변경에서 `selectedStatus`가 `false_alarm`이면 흐름은 이렇게 된다.

```txt
사용자가 상세 화면에서 상태를 오인 신고로 선택
→ PATCH /api/incidents/[id]/status 요청
→ 서버가 status false_alarm인 updated incident 반환
→ setIncident(updated)
→ 컴포넌트 재렌더링
→ calculateIncidentRisk(updated)
→ statusRiskModifier["false_alarm"] = -45 적용
→ risk.level low, risk.score 28 같은 낮은 위험도 결과로 변경 가능
→ UI에 위험도 28 / 낮음 28 형태로 표시
```

이때 현재 Vitest 테스트가 증명하는 것은 이것이다.

```txt
status가 false_alarm인 사고가 calculateIncidentRisk에 들어오면 low / 28로 계산된다.
```

UI 테스트가 추가로 증명해야 하는 것은 이것이다.

```txt
상세 화면에서 false_alarm 상태가 반영된 incident를 받았을 때
화면에 실제로 "위험도 28" 또는 "낮음 28"이 렌더링되는가?
```

즉 현재 테스트와 UI의 관계는 이렇게 나눠야 한다.

```txt
현재 Vitest 단위 테스트
→ 계산 함수가 false_alarm을 low / 28로 만드는지 증명한다.

현재 UI 구현
→ 그 계산 결과를 Badge와 DetailItem에 표시한다.

아직 없는 UI 테스트
→ 실제 DOM에 위험도 28 / 낮음 28이 보이는지 증명해야 한다.
```

#### 5-3-13. 이 테스트가 “무엇을 보고 증명하는지” 정확한 결론

테스트 코드:

```ts
expect(risk).toMatchObject({
  level: "low",
  score: 28,
});
```

이 expect가 직접 보는 것:

```txt
calculateIncidentRisk가 반환한 JavaScript 객체의 level과 score
```

이 expect가 직접 보지 않는 것:

```txt
브라우저 DOM
Badge 컴포넌트 렌더링 결과
화면의 색상
X-Ray 라벨
```

그럼에도 UI와 맞물리는 이유:

```txt
목록 UI와 상세 UI가 risk를 직접 다시 계산하지 않고,
테스트가 검증한 calculateIncidentRisk 함수를 그대로 호출하기 때문이다.
```

최종 인과:

```txt
테스트가 low / 28 계산을 증명한다.
→ UI는 같은 함수의 low / 28 결과를 받는다.
→ 목록 UI는 "위험도 28"과 "낮음 28"을 표시한다.
→ 상세 UI도 "위험도 28"과 "낮음 28"을 표시한다.
→ 하지만 실제 DOM 표시 자체는 별도 UI 테스트가 있어야 직접 증명된다.
```

## 6. 검증 결과

Vitest 단위 테스트:

```bash
npm --workspace @citywatch/api-types run test
```

결과:

```txt
Test Files  1 passed (1)
Tests       3 passed (3)
```

검증한 테스트:

```txt
1. critical + flood + in_progress + 42명 → severe / 100
2. high + traffic + false_alarm + 80명 → low / 28
3. critical + fire + dispatching + 120000명 → severe / 100 clamp
```

추가로 실행할 검증:

```bash
npm run typecheck
npm run test
npm --workspace @citywatch/web run build
```

## 7. 아직 안 한 것

아직 다음은 하지 않았다.

```txt
8. Redux 상태 공유
9. OpenLayers 지도 관제
10. WebSocket/Polling 실시간 처리
11. R3F 3D 위험 구역
12. performance page 대량 데이터 관제
13. Storybook UI 증명
14. realtime-server 분리
15. analytics-remote + Module Federation
```

현재 결론:

```txt
7단계는 사고 데이터를 관제 우선순위로 바꾸는 위험도 계산 규칙을 만들고,
그 규칙을 Vitest 단위 테스트로 검증한 뒤,
목록/상세 화면에서 X-Ray로 출처가 보이게 연결한 단계다.
```
