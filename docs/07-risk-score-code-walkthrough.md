# 7단계 코드 동반 해설: Vitest로 위험도 계산 검증하기

이 문서는 코드와 설명을 분리하지 않는다.
코드를 먼저 보여주고, 바로 아래에서 그 코드가 어떤 흐름으로 동작하는지 설명한다.

읽는 순서:

```txt
1. package.json에서 Vitest 실행 스크립트 확인
2. risk-score.test.ts에서 테스트 문법 확인
3. calculateIncidentRisk 구현 코드와 테스트 입력을 대조
4. 목록/상세 화면에서 같은 함수가 어떻게 쓰이는지 확인
```


## 0. 파일별 판단 근거부터 본다

이번 7단계는 단순히 테스트 파일 하나 추가한 작업이 아니다.
아래 파일들이 각각 다른 책임을 갖고 맞물린다.

```txt
packages/api-types/package.json
→ 이 패키지가 Vitest 테스트를 실행할 수 있게 하는 설정 지점

package-lock.json
→ Vitest 설치 결과를 재현 가능하게 고정하는 잠금 파일

packages/api-types/test/risk-score.test.ts
→ 위험도 계산 규칙을 실행 가능한 테스트로 적은 파일

packages/api-types/src/index.ts
→ 사고 도메인 타입과 위험도 계산 함수가 실제로 사는 파일

apps/web/app/incidents/page.tsx
→ 목록 화면에서 계산된 위험도를 보여주는 소비 지점

apps/web/app/incidents/incident-detail-view.tsx
→ 상세 화면에서 같은 위험도 계산을 재사용하는 소비 지점

apps/web/app/incidents/incident-format.ts
→ 위험도 level을 한글 라벨과 Badge tone으로 바꾸는 표시 지점

docs/*.md
→ 왜 이렇게 만들었는지 학습/면접 설명으로 남기는 기록 지점
```

### 0-1. 왜 `packages/api-types/package.json`에 Vitest를 넣었는가

코드:

```json
{
  "name": "@citywatch/api-types",
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "vitest": "^4.1.10"
  }
}
```

인과:

```txt
위험도 계산 함수는 packages/api-types/src/index.ts에 있다.
그러면 그 함수를 검증하는 test script도 같은 패키지에 있는 게 맞다.
```

루트 `package.json`에만 테스트 명령을 두면 문제가 생긴다.

```txt
루트는 전체 workspace를 묶는 작업장이다.
api-types의 도메인 로직을 직접 소유하지 않는다.
```

그래서 테스트 실행 책임은 이렇게 나눈다.

```txt
루트 package.json
→ 모든 workspace의 test를 한 번에 실행하는 조율자

packages/api-types/package.json
→ api-types 패키지 자기 자신의 테스트를 실행하는 소유자
```

실제 흐름:

```txt
npm run test
→ npm run test --workspaces --if-present
→ @citywatch/api-types의 test script 발견
→ packages/api-types/package.json의 "vitest run" 실행
```

즉 `packages/api-types/package.json`에 `test`를 넣은 이유는 이렇다.

```txt
위험도 계산 로직의 소유자가 api-types 패키지이기 때문에,
그 로직의 테스트 실행 명령도 api-types 패키지가 소유해야 한다.
```

### 0-2. 왜 `vitest`는 dependencies가 아니라 devDependencies인가

코드:

```json
"devDependencies": {
  "vitest": "^4.1.10"
}
```

인과:

```txt
Vitest는 앱 실행 중 필요한 코드가 아니다.
테스트를 작성하고 실행할 때만 필요한 개발 도구다.
```

브라우저에서 사고 목록을 볼 때 Vitest는 필요 없다.
API route에서 사고를 검증할 때도 Vitest는 필요 없다.
빌드 결과물에 포함될 이유도 없다.

그래서 위치는 `dependencies`가 아니라 `devDependencies`다.

반대로 `zod`는 `dependencies`에 남아 있다.

```json
"dependencies": {
  "zod": "^4.4.3"
}
```

이유:

```txt
Zod schema는 사고 등록 화면과 POST API 검증에서 실제 런타임에 사용된다.
즉 개발 도구가 아니라 실행 코드의 일부다.
```

정리:

```txt
vitest → 테스트 실행 도구 → devDependencies
zod    → 런타임 입력 검증 → dependencies
```

### 0-3. 왜 test script는 `vitest run`인가

코드:

```json
"test": "vitest run"
```

인과:

Vitest는 보통 두 방식으로 실행할 수 있다.

```txt
vitest
→ watch 모드로 계속 켜진다.

vitest run
→ 한 번 실행하고 종료한다.
```

현재 프로젝트 단계 검증에는 `run`이 맞다.

```txt
npm run test를 쳤을 때 테스트가 끝나고 터미널이 돌아와야 한다.
CI나 커밋 전 검증에서도 1회 실행이 맞다.
학습 문서의 검증 결과도 pass/fail을 한 번에 보여주는 게 좋다.
```

그래서 `vitest`가 아니라 `vitest run`을 쓴다.

### 0-4. 왜 `package-lock.json`이 바뀌었는가

파일:

```txt
package-lock.json
```

인과:

```txt
npm install --workspace @citywatch/api-types --save-dev vitest
```

이 명령으로 Vitest가 설치되면서 lockfile이 갱신됐다.

`package-lock.json`은 직접 사람이 설계하는 코드 파일이 아니다.
하지만 저장소에는 필요하다.

이유:

```txt
1. Vitest의 정확한 설치 버전과 하위 의존성을 기록한다.
2. 다른 환경에서 npm install을 해도 같은 의존성 트리를 재현한다.
3. 테스트 도구 버전 차이로 결과가 흔들리는 일을 줄인다.
```

즉 이 파일이 바뀐 인과는 다음이다.

```txt
Vitest를 devDependency로 추가했다.
→ npm이 실제 설치된 의존성 트리를 계산했다.
→ 그 결과가 package-lock.json에 기록됐다.
```

### 0-5. 왜 테스트 파일은 `packages/api-types/test/risk-score.test.ts`인가

파일:

```txt
packages/api-types/test/risk-score.test.ts
```

인과:

테스트 대상은 이 함수다.

```ts
calculateIncidentRisk
```

이 함수는 여기 있다.

```txt
packages/api-types/src/index.ts
```

그러면 테스트 파일도 같은 패키지 안에 둔다.

```txt
packages/api-types/src/index.ts
packages/api-types/test/risk-score.test.ts
```

이렇게 둔 이유:

```txt
1. 테스트 대상과 테스트 코드의 소유권이 같다.
2. @citywatch/api-types만 따로 테스트할 수 있다.
3. 루트 npm run test에서도 workspace 단위로 자연스럽게 실행된다.
4. 나중에 web 앱 테스트와 도메인 테스트가 섞이지 않는다.
```

왜 `.ts`인가?

```txt
이 프로젝트는 TypeScript 학습 증명도 포함한다.
테스트 입력도 IncidentRiskInput 타입을 만족해야 한다.
Vitest는 TypeScript 테스트 파일을 처리할 수 있다.
```

그래서 `.mjs`가 아니라 `.test.ts`가 맞다.

### 0-6. 왜 테스트가 `../src/index`를 직접 import하는가

코드:

```ts
import { calculateIncidentRisk, type IncidentRiskInput } from "../src/index";
```

인과:

```txt
테스트는 실제 구현 함수의 public export를 검증해야 한다.
```

이 테스트는 내부 helper를 직접 import하지 않는다.

```txt
getAffectedPeopleRisk 직접 import 안 함
getIncidentRiskLevel 직접 import 안 함
clampRiskScore 직접 import 안 함
```

이유:

```txt
내부 helper는 구현 세부사항이다.
나중에 이름이나 구조가 바뀔 수 있다.
하지만 calculateIncidentRisk의 입력/출력 계약은 외부에서 쓰는 공개 동작이다.
```

따라서 테스트는 이 계약을 검증한다.

```txt
IncidentRiskInput 입력
→ calculateIncidentRisk
→ IncidentRisk 출력
```

### 0-7. 왜 위험도 계산은 `packages/api-types/src/index.ts`에 넣었는가

파일:

```txt
packages/api-types/src/index.ts
```

인과:

위험도 계산은 목록 화면만의 장식이 아니다.

```txt
목록 카드에서 표시
상세 화면에서 표시
이후 지도 마커 색상에 사용 가능
이후 실시간 알림 우선순위에 사용 가능
이후 3D 위험 구역 표현에 사용 가능
```

즉 여러 화면이 공유할 도메인 규칙이다.

그래서 `apps/web/app/incidents/page.tsx` 안에 직접 계산식을 넣지 않았다.

나쁜 구조:

```txt
page.tsx 안에서 점수 계산
→ 상세 화면도 같은 계산식 복사
→ 지도 화면도 같은 계산식 복사
→ 규칙 변경 시 여러 파일 수정
```

현재 구조:

```txt
packages/api-types/src/index.ts
→ calculateIncidentRisk 한 곳에서 계산
→ 목록/상세/이후 기능은 이 함수 호출
```

그래서 인과는 다음이다.

```txt
위험도는 사고 도메인 규칙이다.
도메인 규칙은 특정 화면보다 공유 패키지에 있어야 한다.
그래서 api-types에 둔다.
```

### 0-8. 왜 `incident-format.ts`에 위험도 라벨/톤을 넣었는가

파일:

```txt
apps/web/app/incidents/incident-format.ts
```

코드 역할:

```txt
incidentRiskLevelLabels
getRiskTone(level)
```

인과:

`calculateIncidentRisk`는 도메인 계산만 해야 한다.

```txt
score 계산
level 계산
reasons 생성
```

하지만 한글 표시와 Badge 색상은 UI 표현이다.

```txt
low → 낮음 → success
guarded → 주의 → info
elevated → 높음 → warning
severe → 심각 → danger
```

이걸 `packages/api-types`에 넣으면 도메인 패키지가 UI 표현을 알게 된다.
그건 책임이 섞인다.

그래서 나눴다.

```txt
packages/api-types
→ 위험도 계산 결과를 만든다.

apps/web/app/incidents/incident-format.ts
→ 그 결과를 화면용 한글 라벨과 Badge tone으로 바꾼다.
```

### 0-9. 왜 목록 화면 `page.tsx`를 바꿨는가

파일:

```txt
apps/web/app/incidents/page.tsx
```

인과:

사고 목록은 관제원이 여러 사고를 비교하는 화면이다.
따라서 위험도는 목록에서 바로 보여야 한다.

```txt
사고 제목만 보는 것보다
위험도 점수를 같이 보면
어떤 사고를 먼저 눌러야 할지 판단하기 쉽다.
```

그래서 `IncidentListItem`에서 계산한다.

```tsx
const risk = calculateIncidentRisk(incident);
```

이 값은 별도 state로 두지 않았다.

이유:

```txt
risk는 incident에서 계산되는 파생값이다.
state로 따로 저장하면 incident와 risk가 불일치할 수 있다.
렌더링 시 incident로부터 바로 계산하면 항상 현재 incident 기준이다.
```

### 0-10. 왜 상세 화면 `incident-detail-view.tsx`를 바꿨는가

파일:

```txt
apps/web/app/incidents/incident-detail-view.tsx
```

인과:

상세 화면에서는 사고 상태를 변경할 수 있다.
상태가 바뀌면 위험도도 바뀌어야 한다.

```txt
in_progress → false_alarm
이면 statusRiskModifier가 10에서 -45로 바뀐다.
즉 같은 사고라도 위험도가 낮아져야 한다.
```

그래서 상세 화면도 같은 함수를 호출한다.

```tsx
const risk = incident ? calculateIncidentRisk(incident) : undefined;
```

`incident ? ... : undefined`를 쓴 이유:

```txt
상세 화면은 처음 렌더링 시 API 응답 전이라 incident가 없을 수 있다.
incident가 없는데 위험도를 계산하면 안 된다.
```

상태 변경 후 흐름:

```txt
PATCH 성공
→ setIncident(updated)
→ 재렌더링
→ calculateIncidentRisk(updated)
→ 새 status 기준 위험도 표시
```

### 0-11. 왜 문서 파일을 나눴는가

파일:

```txt
docs/07-risk-score-unit-test.md
docs/07-risk-score-code-walkthrough.md
docs/07-risk-score-test-explainer.md
docs/tech-proof-points.md
README.md
```

인과:

각 문서의 목적이 다르다.

```txt
README.md
→ 저장소를 처음 보는 사람에게 현재 기능과 실행 방법만 짧게 보여준다.

tech-proof-points.md
→ 어떤 프론트엔드 기술을 이 프로젝트에서 증명하는지 요약한다.

07-risk-score-unit-test.md
→ 7단계 완료 보고서다.

07-risk-score-code-walkthrough.md
→ 코드와 해설을 붙여서 흐름을 따라가는 학습 문서다.

07-risk-score-test-explainer.md
→ 테스트와 위험도 계산의 개념 관계를 설명하는 문서다.
```

모든 설명을 README에 넣지 않은 이유:

```txt
README가 길어지면 실행 방법과 프로젝트 목적이 묻힌다.
상세 학습 내용은 docs로 빼는 게 맞다.
```

정리하면 이렇다.

```txt
README는 입구
tech-proof-points는 기술 요약
단계 문서는 보고서
walkthrough는 코드 학습서
explainer는 개념 해설서
```

## 1. 테스트 실행 스크립트

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

해설:

`npm --workspace @citywatch/api-types run test`를 실행하면 `test` script가 실행된다.

```txt
vitest run
```

이 명령은 Vitest를 watch 모드가 아니라 1회 실행 모드로 돌린다.
CI나 단계 검증에서는 계속 켜지는 watch보다 `run`이 맞다.

현재 흐름은 이렇게 간다.


```txt
npm run test
→ workspace test 실행
→ @citywatch/api-types의 vitest run 실행
→ test/risk-score.test.ts 발견
→ TypeScript 테스트 파일 transform
→ 테스트 내부에서 ../src/index import
→ calculateIncidentRisk 실행
→ expect로 결과 검증
```


## 1-1. 테스트가 실제로 동작하는 일련 흐름과 인과

테스트 흐름은 아래 순서로 이어진다.

```txt
1. 루트에서 npm run test 실행
2. 루트 package.json의 workspace test script 실행
3. @citywatch/api-types workspace의 package.json test script 실행
4. vitest run 실행
5. Vitest가 risk-score.test.ts 파일을 찾음
6. 테스트 파일이 ../src/index에서 calculateIncidentRisk를 import
7. describe 그룹 안의 it 테스트 3개 실행
8. 각 it이 calculateIncidentRisk에 테스트 입력을 전달
9. calculateIncidentRisk가 점수 테이블과 helper 함수로 risk를 계산
10. expect가 risk.score / risk.level / risk.reasons를 기대값과 비교
11. 전부 맞으면 Tests 3 passed 출력
```

이 흐름을 코드와 같이 보면 다음이다.

### 1-1-1. 루트 test 명령이 workspace로 내려간다

루트 파일:

```txt
package.json
```

코드:

```json
{
  "scripts": {
    "test": "npm run test --workspaces --if-present"
  }
}
```

인과:

```txt
프로젝트는 모노레포다.
테스트는 루트 한 곳에 몰려 있지 않고 각 workspace가 자기 테스트를 가질 수 있다.
따라서 루트 test는 직접 Vitest를 실행하지 않고,
각 workspace의 test script를 찾아 실행하는 조율자 역할을 한다.
```

그래서 루트에서 아래 명령을 치면:

```bash
npm run test
```

내부적으로 이렇게 내려간다.

```txt
root package.json
→ npm run test --workspaces --if-present
→ test script가 있는 workspace 탐색
→ @citywatch/api-types test 발견
```

### 1-1-2. api-types package.json이 Vitest를 실행한다

파일:

```txt
packages/api-types/package.json
```

코드:

```json
{
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^4.1.10"
  }
}
```

인과:

```txt
위험도 계산 함수는 packages/api-types/src/index.ts에 있다.
그러므로 이 함수를 검증하는 테스트 실행 책임도 packages/api-types가 갖는다.
```

`vitest run`을 쓰는 이유:

```txt
vitest      → watch 모드로 계속 실행될 수 있음
vitest run  → 한 번 실행하고 종료
```

단계 검증과 커밋 전 확인에는 한 번 실행하고 끝나는 `run`이 맞다.

### 1-1-3. Vitest가 테스트 파일을 찾는다

파일:

```txt
packages/api-types/test/risk-score.test.ts
```

Vitest는 기본적으로 이런 이름의 파일을 테스트로 인식한다.

```txt
*.test.ts
*.spec.ts
```

그래서 `risk-score.test.ts`는 별도 설정 없이 테스트 파일로 잡힌다.

인과:

```txt
파일명이 risk-score.test.ts다.
→ Vitest의 기본 테스트 파일 패턴에 맞다.
→ vitest run 실행 시 자동으로 수집된다.
```

### 1-1-4. 테스트 파일이 구현 함수를 import한다

코드:

```ts
import { describe, expect, it } from "vitest";
import { calculateIncidentRisk, type IncidentRiskInput } from "../src/index";
```

인과:

```txt
테스트는 위험도 계산 결과를 검증해야 한다.
위험도 계산 함수는 ../src/index에서 export된다.
따라서 테스트 파일은 calculateIncidentRisk를 import한다.
```

여기서 중요한 점:

```txt
테스트는 내부 helper를 직접 import하지 않는다.
테스트는 public 함수 calculateIncidentRisk만 import한다.
```

이유:

```txt
helper 함수 이름과 구조는 나중에 바뀔 수 있다.
하지만 calculateIncidentRisk(input) → risk output 계약은 화면에서 실제로 쓰는 공개 동작이다.
테스트는 구현 세부가 아니라 공개 동작을 검증해야 한다.
```

### 1-1-5. describe는 테스트 묶음, it은 실제 검증 단위다

코드:

```ts
describe("calculateIncidentRisk", () => {
  it("marks critical active incidents as severe", () => {
    // 첫 번째 규칙 검증
  });

  it("lowers resolved false alarms to low risk", () => {
    // 두 번째 규칙 검증
  });

  it("caps high affected people incidents at 100", () => {
    // 세 번째 규칙 검증
  });
});
```

인과:

```txt
describe("calculateIncidentRisk")
→ 이 테스트 묶음은 calculateIncidentRisk 함수의 동작을 검증한다는 선언이다.

it(...)
→ 위험도 계산 규칙 하나를 실제 입력/출력으로 검증하는 단위다.
```

즉 테스트 3개는 각각 다른 인과를 검증한다.

```txt
1번 it
→ 긴급 활성 사고는 severe/100이 되어야 한다.

2번 it
→ false_alarm은 위험도를 낮춰야 한다.

3번 it
→ 점수는 100을 넘지 않아야 한다.
```

### 1-1-6. it 내부에서 테스트 입력을 만든다

코드:

```ts
const baseIncident = {
  affectedPeople: 0,
  category: "traffic",
  severity: "low",
  status: "reported",
} satisfies IncidentRiskInput;
```

인과:

```txt
calculateIncidentRisk는 Incident 전체가 아니라 네 필드만 필요로 한다.
그래서 테스트 입력도 affectedPeople/category/severity/status만 준비한다.
```

테스트 안에서는 필요한 값만 덮어쓴다.

```ts
const risk = calculateIncidentRisk({
  ...baseIncident,
  affectedPeople: 42,
  category: "flood",
  severity: "critical",
  status: "in_progress",
});
```

인과:

```txt
baseIncident는 기본 입력값이다.
각 테스트는 검증하고 싶은 조건만 덮어쓴다.
그래서 테스트마다 중복 입력을 줄이면서도 최종 입력은 명확하게 만든다.
```

최종 입력:

```ts
{
  affectedPeople: 42,
  category: "flood",
  severity: "critical",
  status: "in_progress"
}
```

### 1-1-7. calculateIncidentRisk가 입력을 받아 계산한다

구현 코드:

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
테스트 입력의 severity/status/category 값은 점수 테이블의 key가 된다.
affectedPeople는 인원 구간 함수의 입력이 된다.
이 네 값을 합산한 뒤 clamp하고 level/reasons를 만든다.
```

예를 들어 첫 번째 테스트 입력은 이렇게 계산된다.

```txt
severityRiskBase["critical"] = 80
statusRiskModifier["in_progress"] = 10
categoryRiskModifier["flood"] = 8
getAffectedPeopleRisk(42) = 10

합계 = 108
clampRiskScore(108) = 100
getIncidentRiskLevel(100) = severe
```

그래서 반환값은 개념적으로 이렇게 된다.

```ts
{
  score: 100,
  level: "severe",
  reasons: [
    "critical severity",
    "in_progress status",
    "flood category",
    "42 affected people"
  ]
}
```

### 1-1-8. expect가 반환값을 검증한다

테스트 코드:

```ts
expect(risk).toMatchObject({
  level: "severe",
  score: 100,
});
expect(risk.reasons).toContain("critical severity");
```

인과:

```txt
calculateIncidentRisk가 반환한 risk 객체가 기대 규칙을 만족하는지 확인한다.
```

`toMatchObject`를 쓰는 이유:

```txt
risk에는 score, level, reasons가 있다.
이 테스트에서 핵심 검증 대상은 level과 score다.
reasons 전체 배열을 완전히 고정하지 않고 필요한 속성만 확인하기 위해 toMatchObject를 쓴다.
```

`toContain`을 쓰는 이유:

```txt
reasons 배열 전체 순서와 모든 내용을 고정하려는 게 아니다.
최소한 critical severity라는 핵심 근거가 포함되는지만 확인한다.
```

즉 검증 의도는 다음이다.

```txt
점수와 등급은 정확히 맞아야 한다.
근거 배열에는 핵심 원인이 포함되어야 한다.
```

### 1-1-9. 테스트 통과가 의미하는 것

Vitest 출력:

```txt
Test Files  1 passed (1)
Tests       3 passed (3)
```

인과:

```txt
risk-score.test.ts 파일이 실행됐다.
그 안의 it 3개가 모두 실행됐다.
각 it 안의 expect가 모두 통과했다.
따라서 현재 위험도 계산 함수는 테스트가 정의한 세 가지 규칙을 만족한다.
```

테스트가 보장하는 것:

```txt
critical + flood + in_progress + 42명 → severe / 100
high + traffic + false_alarm + 80명 → low / 28
critical + fire + dispatching + 120000명 → severe / 100
```

테스트가 보장하지 않는 것:

```txt
위험도 배지가 실제 화면에 보이는지
CSS 색상이 정확한지
모든 severity/status/category 조합이 맞는지
```

이건 테스트 범위 밖이다.
현재 테스트의 범위는 정확히 이것이다.

```txt
calculateIncidentRisk의 핵심 입력/출력 규칙 검증
```

### 1-1-10. 화면까지 이어지는 흐름

목록 화면 코드:

```tsx
const risk = calculateIncidentRisk(incident);
```

인과:

```txt
목록 화면은 API에서 받은 incident를 그대로 calculateIncidentRisk에 넣는다.
테스트가 검증한 함수와 같은 함수다.
따라서 목록 화면의 위험도 값은 테스트된 계산 규칙을 따른다.
```

상세 화면 코드:

```tsx
const risk = incident ? calculateIncidentRisk(incident) : undefined;
```

인과:

```txt
상세 화면은 처음에는 incident가 없을 수 있다.
그래서 incident가 있을 때만 위험도를 계산한다.
상태 변경 후 setIncident(updated)가 되면 재렌더링되고, 변경된 status 기준으로 위험도가 다시 계산된다.
```

전체 연결:

```txt
Vitest 테스트
→ calculateIncidentRisk의 계산 규칙 검증
→ 목록/상세 화면이 같은 함수 호출
→ 화면에 검증된 위험도 결과 표시
```


## 1-2. 하나의 테스트 로직 기준: npm run test부터 pass까지 코드 교차 추적

여기서는 첫 번째 테스트 하나만 기준으로 끝까지 추적한다.
기준 테스트는 이것이다.

```txt
marks critical active incidents as severe
```

목표는 다음 흐름을 코드와 함께 보는 것이다.

```txt
npm run test
→ Vitest 실행
→ 첫 번째 it 실행
→ calculateIncidentRisk 호출
→ 실제 구현 함수 내부 계산
→ risk 반환
→ expect 검증
→ 해당 it pass
```

### 1-2-1. 사용자가 터미널에서 테스트를 시작한다

사용자가 실행하는 명령:

```bash
npm run test
```

이 명령은 먼저 루트 `package.json`을 본다.

테스트 실행 코드:

```json
{
  "scripts": {
    "test": "npm run test --workspaces --if-present"
  }
}
```

실제 구현/설정 코드 위치:

```txt
package.json
```

인과:

```txt
루트는 모노레포 전체 작업장이다.
따라서 루트의 test는 직접 테스트 파일을 실행하지 않는다.
각 workspace에 test script가 있으면 실행하라고 npm에 위임한다.
```

흐름:

```txt
npm run test
→ npm run test --workspaces --if-present
→ apps/*, packages/* workspace를 확인
→ test script가 있는 workspace를 찾음
```

### 1-2-2. npm이 api-types workspace의 test script로 내려간다

테스트 실행 코드:

```json
{
  "name": "@citywatch/api-types",
  "scripts": {
    "test": "vitest run"
  }
}
```

실제 구현/설정 코드 위치:

```txt
packages/api-types/package.json
```

인과:

```txt
위험도 계산 함수는 packages/api-types/src/index.ts에 있다.
그래서 그 함수를 검증하는 테스트 실행 명령도 @citywatch/api-types 패키지가 소유한다.
```

흐름:

```txt
루트 workspace test
→ @citywatch/api-types package.json 발견
→ "test": "vitest run" 실행
```

### 1-2-3. Vitest가 테스트 파일을 수집한다

Vitest가 찾는 테스트 파일:

```txt
packages/api-types/test/risk-score.test.ts
```

테스트 코드:

```ts
import { describe, expect, it } from "vitest";
import { calculateIncidentRisk, type IncidentRiskInput } from "../src/index";
```

실제 구현 코드와의 연결:

```txt
../src/index
→ packages/api-types/src/index.ts
```

인과:

```txt
Vitest는 risk-score.test.ts를 테스트 파일로 인식한다.
그 파일은 ../src/index에서 calculateIncidentRisk를 import한다.
따라서 테스트가 실행되면 실제 구현 함수인 calculateIncidentRisk를 호출할 수 있다.
```

여기서 중요한 점:

```txt
테스트가 mock 함수를 부르는 게 아니다.
테스트가 복사한 계산식을 부르는 것도 아니다.
실제 운영 코드와 같은 calculateIncidentRisk를 부른다.
```

### 1-2-4. 테스트 그룹이 등록된다

테스트 코드:

```ts
describe("calculateIncidentRisk", () => {
  it("marks critical active incidents as severe", () => {
    // 첫 번째 테스트 본문
  });
});
```

인과:

```txt
describe는 테스트 묶음 이름이다.
이 묶음 안의 it들은 calculateIncidentRisk의 동작을 검증한다.
```

Vitest 입장에서 이 시점의 흐름:

```txt
risk-score.test.ts 로드
→ describe("calculateIncidentRisk") 등록
→ 내부 it 테스트들 등록
→ 첫 번째 it 실행 준비
```

### 1-2-5. 첫 번째 it이 실행되고 테스트 입력을 만든다

테스트 코드:

```ts
const baseIncident = {
  affectedPeople: 0,
  category: "traffic",
  severity: "low",
  status: "reported",
} satisfies IncidentRiskInput;
```

인과:

```txt
calculateIncidentRisk는 Incident 전체가 필요하지 않다.
필요한 것은 affectedPeople, category, severity, status 네 필드다.
그래서 테스트 기본값도 네 필드만 가진다.
```

이제 첫 번째 테스트가 이 기본값을 덮어쓴다.

테스트 코드:

```ts
const risk = calculateIncidentRisk({
  ...baseIncident,
  affectedPeople: 42,
  category: "flood",
  severity: "critical",
  status: "in_progress",
});
```

이 코드가 만드는 최종 입력:

```ts
{
  affectedPeople: 42,
  category: "flood",
  severity: "critical",
  status: "in_progress"
}
```

인과:

```txt
...baseIncident가 기본값을 먼저 펼친다.
그 뒤 affectedPeople/category/severity/status가 같은 key를 덮어쓴다.
따라서 첫 번째 테스트는 critical + flood + in_progress + 42명 사고를 만든다.
```

### 1-2-6. 테스트 코드가 실제 구현 함수로 들어간다

테스트 코드:

```ts
const risk = calculateIncidentRisk({
  ...baseIncident,
  affectedPeople: 42,
  category: "flood",
  severity: "critical",
  status: "in_progress",
});
```

여기서 호출되는 실제 구현 코드:

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
테스트의 calculateIncidentRisk(...) 호출은 packages/api-types/src/index.ts의 실제 함수를 실행한다.
이 함수는 테스트 입력 객체를 incident 매개변수로 받는다.
```

즉 함수 내부에서 incident는 지금 이 값이다.

```ts
incident = {
  affectedPeople: 42,
  category: "flood",
  severity: "critical",
  status: "in_progress"
}
```

### 1-2-7. 구현 코드 첫 줄이 affectedPeople를 만든다

실제 구현 코드:

```ts
const affectedPeople = Math.max(0, incident.affectedPeople);
```

테스트 입력 대입:

```txt
incident.affectedPeople = 42
Math.max(0, 42) = 42
```

결과:

```ts
affectedPeople = 42;
```

인과:

```txt
계산 함수는 음수 인원이 들어와도 최소 0으로 보정한다.
현재 테스트 입력은 42라 그대로 42가 된다.
```

### 1-2-8. 구현 코드가 severity 점수를 조회한다

실제 구현 코드:

```ts
severityRiskBase[incident.severity]
```

점수 테이블 코드:

```ts
const severityRiskBase: Record<IncidentSeverity, number> = {
  low: 12,
  medium: 32,
  high: 60,
  critical: 80,
};
```

테스트 입력 대입:

```txt
incident.severity = "critical"
severityRiskBase["critical"] = 80
```

인과:

```txt
첫 번째 테스트는 critical 사고를 만든다.
critical은 severity 기본 점수 80을 가진다.
```

### 1-2-9. 구현 코드가 status 점수를 조회한다

실제 구현 코드:

```ts
statusRiskModifier[incident.status]
```

점수 테이블 코드:

```ts
const statusRiskModifier: Record<IncidentStatus, number> = {
  reported: 5,
  dispatching: 12,
  in_progress: 10,
  resolved: -25,
  false_alarm: -45,
};
```

테스트 입력 대입:

```txt
incident.status = "in_progress"
statusRiskModifier["in_progress"] = 10
```

인과:

```txt
첫 번째 테스트는 아직 대응 중인 사고를 만든다.
in_progress는 아직 종료되지 않은 상태라 위험도를 10점 올린다.
```

### 1-2-10. 구현 코드가 category 점수를 조회한다

실제 구현 코드:

```ts
categoryRiskModifier[incident.category]
```

점수 테이블 코드:

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

테스트 입력 대입:

```txt
incident.category = "flood"
categoryRiskModifier["flood"] = 8
```

인과:

```txt
첫 번째 테스트는 침수 사고를 만든다.
flood는 category 보정 점수 8을 가진다.
```

### 1-2-11. 구현 코드가 affectedPeople 점수를 계산한다

실제 구현 코드:

```ts
getAffectedPeopleRisk(affectedPeople)
```

호출되는 helper 코드:

```ts
function getAffectedPeopleRisk(affectedPeople: number) {
  if (affectedPeople >= 1000) return 25;
  if (affectedPeople >= 100) return 18;
  if (affectedPeople >= 30) return 10;
  if (affectedPeople >= 1) return 5;
  return 0;
}
```

테스트 입력 대입:

```txt
affectedPeople = 42
42 >= 1000 ? false
42 >= 100 ? false
42 >= 30 ? true
return 10
```

결과:

```txt
getAffectedPeopleRisk(42) = 10
```

인과:

```txt
영향 인원이 42명이면 30명 이상 구간이다.
따라서 영향 인원 보정 점수는 10점이다.
```

### 1-2-12. 구현 코드가 네 점수를 합산한다

실제 구현 코드:

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
severityRiskBase["critical"] = 80
statusRiskModifier["in_progress"] = 10
categoryRiskModifier["flood"] = 8
getAffectedPeopleRisk(42) = 10
```

합산:

```txt
80 + 10 + 8 + 10 = 108
```

인과:

```txt
critical 사고이고, 아직 대응 중이고, 침수 사고이고, 영향 인원이 42명이다.
따라서 원점수는 108점까지 올라간다.
```

### 1-2-13. 구현 코드가 score를 100으로 제한한다

호출되는 helper 코드:

```ts
function clampRiskScore(score: number) {
  return Math.min(100, Math.max(0, Math.round(score)));
}
```

대입:

```txt
score = 108
Math.round(108) = 108
Math.max(0, 108) = 108
Math.min(100, 108) = 100
```

결과:

```ts
score = 100;
```

인과:

```txt
위험도 점수는 UI와 정렬 기준에서 0~100 범위여야 한다.
원점수 108은 상한을 넘으므로 100으로 잘린다.
```

### 1-2-14. 구현 코드가 level을 계산한다

실제 구현 코드:

```ts
level: getIncidentRiskLevel(score)
```

호출되는 helper 코드:

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
score = 100
100 >= 80 ? true
return "severe"
```

결과:

```ts
level = "severe";
```

인과:

```txt
100점은 severe 구간이다.
따라서 이 사고는 최고 위험도다.
```

### 1-2-15. 구현 코드가 reasons를 만든다

실제 구현 코드:

```ts
reasons: getIncidentRiskReasons(incident, affectedPeople)
```

호출되는 helper 코드:

```ts
function getIncidentRiskReasons(incident: IncidentRiskInput, affectedPeople: number) {
  const reasons = [
    `${incident.severity} severity`,
    `${incident.status} status`,
    `${incident.category} category`,
  ];
  if (affectedPeople > 0) reasons.push(`${affectedPeople} affected people`);
  return reasons;
}
```

테스트 입력 대입:

```txt
incident.severity = "critical"
incident.status = "in_progress"
incident.category = "flood"
affectedPeople = 42
```

결과:

```ts
reasons = [
  "critical severity",
  "in_progress status",
  "flood category",
  "42 affected people"
];
```

인과:

```txt
reasons는 왜 이 위험도가 나왔는지 설명하는 근거다.
첫 번째 테스트는 최소한 critical severity 근거가 포함되는지 확인한다.
```

### 1-2-16. 구현 함수가 risk를 반환한다

실제 구현 코드:

```ts
return {
  score,
  level: getIncidentRiskLevel(score),
  reasons: getIncidentRiskReasons(incident, affectedPeople),
};
```

이 시점의 실제 반환값은 개념적으로 다음이다.

```ts
{
  score: 100,
  level: "severe",
  reasons: [
    "critical severity",
    "in_progress status",
    "flood category",
    "42 affected people"
  ]
}
```

이 값이 다시 테스트 코드의 `risk` 변수에 들어간다.

테스트 코드:

```ts
const risk = calculateIncidentRisk({
  ...baseIncident,
  affectedPeople: 42,
  category: "flood",
  severity: "critical",
  status: "in_progress",
});
```

인과:

```txt
calculateIncidentRisk 호출 결과가 risk 변수에 저장된다.
이제 테스트는 risk가 기대한 모양인지 검증한다.
```

### 1-2-17. 테스트 코드가 score와 level을 검증한다

테스트 코드:

```ts
expect(risk).toMatchObject({
  level: "severe",
  score: 100,
});
```

실제 risk:

```ts
{
  score: 100,
  level: "severe",
  reasons: [
    "critical severity",
    "in_progress status",
    "flood category",
    "42 affected people"
  ]
}
```

비교:

```txt
risk.level === "severe" → true
risk.score === 100 → true
```

결과:

```txt
toMatchObject 통과
```

인과:

```txt
첫 번째 테스트의 핵심 기대는 severe/100이다.
실제 구현이 severe/100을 반환했으므로 이 검증은 통과한다.
```

### 1-2-18. 테스트 코드가 reasons를 검증한다

테스트 코드:

```ts
expect(risk.reasons).toContain("critical severity");
```

실제 reasons:

```ts
[
  "critical severity",
  "in_progress status",
  "flood category",
  "42 affected people"
]
```

비교:

```txt
reasons 안에 "critical severity"가 있는가?
→ yes
```

결과:

```txt
toContain 통과
```

인과:

```txt
점수만 맞는 게 아니라, 위험도 근거에도 critical severity가 남아 있어야 한다.
실제 reasons에 해당 문자열이 있으므로 통과한다.
```

### 1-2-19. 첫 번째 it이 pass된다

첫 번째 it 전체:

```ts
it("marks critical active incidents as severe", () => {
  const risk = calculateIncidentRisk({
    ...baseIncident,
    affectedPeople: 42,
    category: "flood",
    severity: "critical",
    status: "in_progress",
  });

  expect(risk).toMatchObject({
    level: "severe",
    score: 100,
  });
  expect(risk.reasons).toContain("critical severity");
});
```

통과 조건:

```txt
1. calculateIncidentRisk가 예외 없이 실행된다.
2. risk.level이 severe다.
3. risk.score가 100이다.
4. risk.reasons에 critical severity가 포함된다.
```

모두 만족했으므로 Vitest는 이 테스트를 pass로 처리한다.

```txt
✓ marks critical active incidents as severe
```

### 1-2-20. 남은 it들도 같은 방식으로 실행되고 최종 결과가 나온다

Vitest는 같은 파일 안의 다음 테스트도 실행한다.

```ts
it("lowers resolved false alarms to low risk", () => {
  // false_alarm → low / 28 검증
});

it("caps high affected people incidents at 100", () => {
  // 125점 원점수 → 100 clamp 검증
});
```

세 테스트가 전부 통과하면 출력은 이런 의미를 가진다.

```txt
Test Files  1 passed (1)
Tests       3 passed (3)
```

인과:

```txt
risk-score.test.ts 파일 1개가 통과했다.
그 안의 it 테스트 3개가 모두 통과했다.
따라서 현재 calculateIncidentRisk는 테스트가 정의한 위험도 핵심 규칙을 만족한다.
```

## 2. Vitest 테스트 파일의 import 코드

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

첫 번째 줄:

```ts
import { describe, expect, it } from "vitest";
```

Vitest에서 테스트를 작성할 때 쓰는 기본 함수들이다.

```txt
describe
→ 관련 테스트들을 하나의 그룹으로 묶는다.

it
→ 실제 테스트 케이스 하나를 정의한다.

expect
→ 실제 결과가 기대 결과와 맞는지 검증한다.
```

두 번째 줄:

```ts
import { calculateIncidentRisk, type IncidentRiskInput } from "../src/index";
```

이 줄이 테스트 코드와 구현 코드를 직접 연결한다.

```txt
risk-score.test.ts
→ ../src/index import
→ calculateIncidentRisk 함수 호출
```

중요한 점은 테스트 파일에서 구현 원본을 바로 가져온다는 것이다.
Vitest가 TypeScript import를 처리하므로 별도 컴파일 산출물을 직접 import하지 않는다.

`type IncidentRiskInput`은 타입 전용 import다.
런타임에는 사라지고 TypeScript 검사에만 쓰인다.

## 3. 테스트 입력 기본값 코드

코드:

```ts
const baseIncident = {
  affectedPeople: 0,
  category: "traffic",
  severity: "low",
  status: "reported",
} satisfies IncidentRiskInput;
```

해설:

`calculateIncidentRisk`는 전체 사고 객체가 아니라 계산에 필요한 네 필드만 받는다.

```ts
export type IncidentRiskInput = Pick<
  Incident,
  "affectedPeople" | "category" | "severity" | "status"
>;
```

즉 테스트 입력도 이 네 필드면 충분하다.

```txt
affectedPeople
category
severity
status
```

여기서 `satisfies IncidentRiskInput`이 중요하다.

```ts
} satisfies IncidentRiskInput;
```

의미:

```txt
baseIncident 객체가 IncidentRiskInput 조건을 만족하는지 TypeScript가 검사한다.
하지만 객체의 literal 타입은 최대한 유지한다.
```

예를 들어 `severity: "bad"`처럼 없는 값을 넣으면 테스트 실행 전에 타입체크 단계에서 잡을 수 있다.

## 4. Vitest 테스트 그룹 코드

코드:

```ts
describe("calculateIncidentRisk", () => {
  it("marks critical active incidents as severe", () => {
    // test body
  });

  it("lowers resolved false alarms to low risk", () => {
    // test body
  });

  it("caps high affected people incidents at 100", () => {
    // test body
  });
});
```

해설:

`describe`는 테스트를 그룹으로 묶는다.
현재 그룹 이름은 `calculateIncidentRisk`다.

```txt
이 파일의 테스트들은 calculateIncidentRisk 함수의 동작을 검증한다.
```

`it`은 개별 테스트 케이스다.
각 `it`은 하나의 규칙을 검증한다.

```txt
1. 긴급/진행 중 사고는 severe가 된다.
2. false_alarm은 위험도를 낮춘다.
3. 점수는 100을 넘지 않는다.
```

## 5. 테스트 1번: 긴급 활성 사고는 severe가 된다

테스트 코드:

```ts
it("marks critical active incidents as severe", () => {
  const risk = calculateIncidentRisk({
    ...baseIncident,
    affectedPeople: 42,
    category: "flood",
    severity: "critical",
    status: "in_progress",
  });

  expect(risk).toMatchObject({
    level: "severe",
    score: 100,
  });
  expect(risk.reasons).toContain("critical severity");
});
```

해설:

테스트 입력은 최종적으로 이렇게 된다.

```ts
{
  affectedPeople: 42,
  category: "flood",
  severity: "critical",
  status: "in_progress"
}
```

이 입력이 구현 함수로 들어간다.

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

값을 코드에 대입하면 다음이다.

```txt
severityRiskBase["critical"] = 80
statusRiskModifier["in_progress"] = 10
categoryRiskModifier["flood"] = 8
getAffectedPeopleRisk(42) = 10
```

합산:

```txt
80 + 10 + 8 + 10 = 108
```

그 다음 `clampRiskScore`가 100으로 자른다.

```ts
function clampRiskScore(score: number) {
  return Math.min(100, Math.max(0, Math.round(score)));
}
```

```txt
clampRiskScore(108)
→ 100
```

level 계산:

```ts
function getIncidentRiskLevel(score: number): IncidentRiskLevel {
  if (score >= 80) return "severe";
  if (score >= 60) return "elevated";
  if (score >= 35) return "guarded";
  return "low";
}
```

```txt
score = 100
100 >= 80
→ severe
```

그래서 이 expectation이 맞다.

```ts
expect(risk).toMatchObject({
  level: "severe",
  score: 100,
});
```

`toMatchObject`는 객체의 일부 속성이 기대값과 맞는지 본다.
여기서는 `risk` 객체 안의 `level`, `score`를 확인한다.

다음 expectation:

```ts
expect(risk.reasons).toContain("critical severity");
```

이 검증은 아래 구현과 연결된다.

```ts
function getIncidentRiskReasons(incident: IncidentRiskInput, affectedPeople: number) {
  const reasons = [
    `${incident.severity} severity`,
    `${incident.status} status`,
    `${incident.category} category`,
  ];
  if (affectedPeople > 0) reasons.push(`${affectedPeople} affected people`);
  return reasons;
}
```

`incident.severity`가 `critical`이므로 `reasons`에는 `critical severity`가 들어간다.

## 6. 테스트 2번: false_alarm은 위험도를 낮춘다

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

해설:

`category`는 직접 쓰지 않았지만 `baseIncident`에서 온다.
최종 입력은 다음이다.

```ts
{
  affectedPeople: 80,
  category: "traffic",
  severity: "high",
  status: "false_alarm"
}
```

계산:

```txt
severityRiskBase["high"] = 60
statusRiskModifier["false_alarm"] = -45
categoryRiskModifier["traffic"] = 3
getAffectedPeopleRisk(80) = 10
```

80명이 왜 10점인지 코드로 보면 이렇다.

```ts
function getAffectedPeopleRisk(affectedPeople: number) {
  if (affectedPeople >= 1000) return 25;
  if (affectedPeople >= 100) return 18;
  if (affectedPeople >= 30) return 10;
  if (affectedPeople >= 1) return 5;
  return 0;
}
```

```txt
80 >= 1000 false
80 >= 100 false
80 >= 30 true
→ 10
```

합산:

```txt
60 + (-45) + 3 + 10 = 28
```

level:

```txt
28 >= 80 false
28 >= 60 false
28 >= 35 false
→ low
```

그래서 이 expectation이 맞다.

```ts
expect(risk).toMatchObject({
  level: "low",
  score: 28,
});
```

이 테스트가 보호하는 규칙은 명확하다.

```txt
심각도 high라도 false_alarm이면 위험도를 낮춰야 한다.
```

누가 `false_alarm: -45`를 약하게 바꾸면 score가 28이 아니게 되고 이 테스트가 실패한다.

## 7. 테스트 3번: 위험도 점수는 100을 넘지 않는다

테스트 코드:

```ts
it("caps high affected people incidents at 100", () => {
  const risk = calculateIncidentRisk({
    ...baseIncident,
    affectedPeople: 120000,
    category: "fire",
    severity: "critical",
    status: "dispatching",
  });

  expect(risk).toMatchObject({
    level: "severe",
    score: 100,
  });
});
```

해설:

최종 입력:

```ts
{
  affectedPeople: 120000,
  category: "fire",
  severity: "critical",
  status: "dispatching"
}
```

계산:

```txt
severityRiskBase["critical"] = 80
statusRiskModifier["dispatching"] = 12
categoryRiskModifier["fire"] = 8
getAffectedPeopleRisk(120000) = 25
```

합산:

```txt
80 + 12 + 8 + 25 = 125
```

하지만 `clampRiskScore`가 100으로 제한한다.

```txt
clampRiskScore(125)
→ 100
```

그래서 이 expectation이 맞다.

```ts
expect(risk).toMatchObject({
  level: "severe",
  score: 100,
});
```

이 테스트가 보호하는 규칙:

```txt
영향 인원이 아무리 커도 위험도 점수는 100을 넘지 않는다.
```

## 8. 구현 코드 전체와 테스트의 맞물림

구현 코드:

```ts
const severityRiskBase: Record<IncidentSeverity, number> = {
  low: 12,
  medium: 32,
  high: 60,
  critical: 80,
};

const statusRiskModifier: Record<IncidentStatus, number> = {
  reported: 5,
  dispatching: 12,
  in_progress: 10,
  resolved: -25,
  false_alarm: -45,
};

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

해설:

테스트 입력의 문자열 값이 이 객체들의 key로 쓰인다.

```txt
severity: "critical"
→ severityRiskBase["critical"]

status: "false_alarm"
→ statusRiskModifier["false_alarm"]

category: "fire"
→ categoryRiskModifier["fire"]
```

그래서 테스트는 단순히 결과만 보는 게 아니다.
점수 테이블이 의도대로 적용되는지도 같이 검증한다.

구현 코드:

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

해설:

이 함수가 테스트의 직접 대상이다.
Vitest 테스트는 내부 helper를 직접 import하지 않는다.
오직 public 함수인 `calculateIncidentRisk`만 호출한다.

```txt
테스트 입력
→ calculateIncidentRisk
→ 내부 helper 실행
→ IncidentRisk 반환
→ expect로 결과 검증
```

이 방식이 좋은 이유:

```txt
내부 helper 이름이나 구조는 나중에 바꿀 수 있다.
하지만 calculateIncidentRisk의 입력/출력 계약이 깨지면 테스트가 실패한다.
```

즉 테스트가 붙잡는 것은 내부 구현 모양이 아니라 공개 동작이다.

## 9. 화면 코드와 테스트 코드의 연결

목록 화면 코드:

```tsx
function IncidentListItem({
  incident,
  xray,
}: {
  incident: Incident;
  xray: boolean;
}) {
  const risk = calculateIncidentRisk(incident);

  return (
    <li>
      <Badge tone={getRiskTone(risk.level)}>위험도 {risk.score}</Badge>
    </li>
  );
}
```

해설:

목록 화면은 위험도 계산식을 직접 갖고 있지 않다.
사고 객체를 `calculateIncidentRisk`에 넣고 결과만 표시한다.

```txt
화면 책임
→ 위험도 결과를 보여준다.

calculateIncidentRisk 책임
→ 위험도 결과를 계산한다.

Vitest 테스트 책임
→ calculateIncidentRisk 결과가 깨지지 않게 검증한다.
```

상세 화면 코드:

```tsx
const risk = incident ? calculateIncidentRisk(incident) : undefined;
```

해설:

상세 화면은 API 응답을 받기 전에는 `incident`가 없을 수 있다.
그래서 `incident`가 있을 때만 위험도를 계산한다.

상태 변경 흐름:

```txt
PATCH /api/incidents/[id]/status
→ updated incident 응답
→ setIncident(updated)
→ 재렌더링
→ calculateIncidentRisk(updated)
→ 변경된 status 기준으로 위험도 재계산
```

예를 들어 상태가 `false_alarm`으로 바뀌면 `statusRiskModifier["false_alarm"] = -45`가 적용된다.
이 규칙은 테스트 2번이 검증한다.

## 10. Vitest 테스트 결과 읽는 법

실행:

```bash
npm --workspace @citywatch/api-types run test
```

출력 예시:

```txt
RUN  v4.1.10 .../packages/api-types

Test Files  1 passed (1)
     Tests  3 passed (3)
```

해설:

```txt
Test Files 1 passed
→ risk-score.test.ts 파일이 통과했다.

Tests 3 passed
→ it(...) 테스트 케이스 3개가 전부 통과했다.
```

현재 3개 테스트가 통과한다는 뜻은 다음이다.

```txt
critical active 사고는 severe/100이 된다.
false_alarm은 low/28로 낮아진다.
영향 인원이 큰 사고도 100점 상한을 넘지 않는다.
```

## 11. 최종 연결 요약

```txt
risk-score.test.ts
→ Vitest의 describe/it/expect로 테스트 작성
→ calculateIncidentRisk를 ../src/index에서 직접 import
→ 테스트 입력 객체 전달
→ score/level/reasons 검증
```

```txt
src/index.ts
→ severity/status/category/affectedPeople 점수 계산
→ 0~100 clamp
→ level/reasons 생성
→ IncidentRisk 반환
```

```txt
page.tsx / incident-detail-view.tsx
→ 같은 calculateIncidentRisk 호출
→ 테스트로 검증된 결과를 화면에 표시
```

한 줄로 정리하면 이렇다.

```txt
Vitest 테스트는 calculateIncidentRisk의 입력/출력 계약을 고정하고, 화면은 그 검증된 함수를 호출해서 위험도를 보여준다.
```