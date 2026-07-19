# 13. Storybook UI 증명

Storybook은 애플리케이션 전체를 실행하지 않고 React 컴포넌트를 독립적으로 렌더링하고 조작하는 UI 개발 환경이다. 이 프로젝트에서는 `packages/ui`의 공용 컴포넌트를 실제 스타일과 함께 격리해 확인하고, 주요 상태와 상호작용을 Story로 남긴다.

## 1. Storybook을 사용하는 이유

일반 화면에서 `SeverityBadge`의 모든 상태를 확인하려면 심각도가 `low`, `medium`, `high`, `critical`인 데이터를 각각 준비해야 한다. Storybook에서는 컴포넌트의 props를 직접 지정하므로 페이지, API, 전역 상태 없이 필요한 UI 상태를 즉시 확인할 수 있다.

```txt
일반 애플리케이션
→ 페이지
→ API와 상태
→ 컴포넌트

Storybook
→ Story
→ props(args)
→ 컴포넌트
```

Story는 컴포넌트가 특정 상태에 놓인 하나의 사례다. Storybook은 전체 애플리케이션의 E2E 검증을 대체하지 않으며, 컴포넌트 단위의 모양, 상태, 상호작용을 개발하고 검증하는 데 사용한다.

## 2. 실제 코드 위치

| 순서 | 파일 | 확인할 내용 |
| --- | --- | --- |
| 1 | [`package.json`](../package.json) | 실행 명령과 Storybook 패키지 |
| 2 | [`.storybook/main.ts`](../.storybook/main.ts) | Story 검색 범위와 React/Vite 설정 |
| 3 | [`.storybook/preview.ts`](../.storybook/preview.ts) | 공용 CSS와 전역 화면 옵션 |
| 4 | [`packages/ui/src/badge.tsx`](../packages/ui/src/badge.tsx) | 실제 `Badge` 구현 |
| 5 | [`packages/ui/src/badge.stories.tsx`](../packages/ui/src/badge.stories.tsx) | args, Controls, Decorator 예제 |
| 6 | [`packages/ui/src/severity-badge.tsx`](../packages/ui/src/severity-badge.tsx) | 심각도와 Badge 색상 매핑 |
| 7 | [`packages/ui/src/severity-badge.stories.tsx`](../packages/ui/src/severity-badge.stories.tsx) | 심각도별 Story |
| 8 | [`packages/ui/src/xray.tsx`](../packages/ui/src/xray.tsx) | X-Ray 컴포넌트와 접근성 속성 |
| 9 | [`packages/ui/src/xray.stories.tsx`](../packages/ui/src/xray.stories.tsx) | 상태와 `play` 상호작용 테스트 |
| 10 | [`packages/ui/src/styles.css`](../packages/ui/src/styles.css) | Storybook에서도 사용하는 실제 스타일 |

## 3. 설치된 패키지와 명령

루트 `package.json`에는 Storybook 핵심 패키지와 React/Vite 연결 패키지가 설치되어 있다.

```json
{
  "devDependencies": {
    "@storybook/react-vite": "^10.5.2",
    "storybook": "^10.5.2"
  }
}
```

```txt
storybook
→ Storybook CLI와 핵심 기능

@storybook/react-vite
→ React 컴포넌트를 Vite 환경에서 변환하고 렌더링
```

실행 명령은 다음 두 개다.

```json
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  }
}
```

`npm run storybook`은 개발 서버를 열고, `npm run build-storybook`은 배포 가능한 정적 결과를 만든다.

## 4. `main.ts`: Story 수집 설정

`.storybook/main.ts`는 Storybook 서버가 어떤 파일을 수집하고 어떤 프레임워크로 렌더링할지 정한다.

```ts
const config: StorybookConfig = {
  stories: ["../packages/ui/src/**/*.stories.@(ts|tsx)"],
  framework: "@storybook/react-vite",
};
```

`stories` 패턴은 `packages/ui/src` 아래의 `.stories.ts`, `.stories.tsx` 파일을 자동으로 찾는다. 새 컴포넌트의 Story 파일을 같은 위치에 추가하면 별도 등록 없이 Sidebar에 나타난다.

`framework`는 React 컴포넌트를 Vite 기반 Storybook에서 실행하도록 지정한다.

## 5. `preview.ts`: 공통 렌더링 설정

`.storybook/preview.ts`는 모든 Story에 적용되는 브라우저 렌더링 설정이다.

```ts
import "../packages/ui/src/styles.css";

const preview: Preview = {
  parameters: {
    controls: {
      expanded: true,
    },
    layout: "centered",
  },
};
```

`styles.css`를 여기서 한 번 불러오기 때문에 Storybook의 컴포넌트도 실제 애플리케이션과 같은 `cw-badge`, `cw-xray-box` 스타일을 사용한다.

```txt
layout: "centered"
→ Canvas 가운데에 컴포넌트 배치

controls.expanded: true
→ Controls 항목을 펼쳐서 표시
```

공통 설정은 세 단계에서 구체화할 수 있다.

```txt
preview.ts의 전역 설정
→ stories 파일의 meta 설정
→ 개별 Story 설정
```

## 6. 실행 후 작동 순서

저장소 루트에서 실행한다.

```bash
npm run storybook
```

브라우저에서 다음 주소를 연다.

```txt
http://localhost:6006
```

내부 작동 순서는 다음과 같다.

```txt
1. Storybook CLI가 6006번 개발 서버 실행
2. main.ts의 stories 패턴으로 Story 파일 검색
3. 각 파일의 default export인 meta 수집
4. preview.ts 실행과 공용 CSS 로드
5. meta.title과 Story 이름으로 Sidebar 구성
6. 사용자가 Story 선택
7. args를 실제 React 컴포넌트의 props로 전달
8. Canvas에 컴포넌트 렌더링
9. Controls에서 args를 변경하면 컴포넌트 재렌더링
10. play가 있으면 렌더링 후 사용자 상호작용과 검증 실행
```

화면은 세 영역으로 본다.

```txt
왼쪽 Sidebar
→ 컴포넌트와 Story 선택

가운데 Canvas
→ 실제 컴포넌트 렌더링 결과

Addon Panel
→ Controls와 테스트 결과 확인
```

## 7. Badge Story: args와 Controls

`badge.stories.tsx`의 meta는 `Badge`를 Storybook에 등록한다.

```ts
const meta = {
  title: "Shared UI/Badge",
  component: Badge,
  args: {
    children: "Monitoring",
    tone: "neutral",
  },
  argTypes: {
    tone: {
      control: "inline-radio",
      options: ["neutral", "info", "success", "warning", "danger"],
    },
  },
} satisfies Meta<typeof Badge>;
```

| 설정 | 역할 |
| --- | --- |
| `title` | Sidebar의 `Shared UI / Badge` 경로 |
| `component` | 실제 렌더링할 React 컴포넌트 |
| `args` | 기본 props |
| `argTypes` | Controls에서 props를 편집하는 방법 |
| `satisfies Meta` | Story 설정과 컴포넌트 props의 타입 검사 |

### Playground

```ts
export const Playground: Story = {};
```

Story가 비어 있어도 meta의 `component`와 `args`를 사용해 다음과 같은 결과를 렌더링한다.

```tsx
<Badge tone="neutral">Monitoring</Badge>
```

Controls에서 `tone`을 변경하면 args가 바뀌고 `Badge`가 즉시 재렌더링된다.

### CriticalIncident

```ts
export const CriticalIncident: Story = {
  args: {
    children: "Critical Incident",
    tone: "danger",
  },
  argTypes: {
    children: {
      control: "text",
      description: "Badge 안에 표시할 문구",
    },
    tone: {
      control: "inline-radio",
      options: ["neutral", "info", "success", "warning", "danger"],
      description: "Badge의 의미와 색상",
    },
  },
};
```

이 Story는 컴포넌트를 복사하지 않고 args만 바꿔 위험 상태를 고정한다. `children`은 텍스트 입력, `tone`은 라디오 버튼으로 조작할 수 있다.

Story 이름은 구현 색상보다 사용자의 의미를 표현한다.

```txt
RedBadge보다 CriticalIncident가 적합
```

### Tones와 Decorator

`Tones`는 모든 tone을 한 화면에서 비교한다. Story 전용 Decorator는 비교 영역에 배경과 여백을 제공한다.

```tsx
decorators: [
  (Story) => (
    <div style={{ background: "#ffffff", padding: "2rem" }}>
      <Story />
    </div>
  ),
],
```

Decorator는 Story 자체를 변경하지 않고 Theme, Redux, Router, Context, 공통 레이아웃 같은 실행 환경을 제공할 때 사용한다.

```txt
모든 Story에 필요
→ preview의 전역 Decorator

한 컴포넌트의 모든 Story에 필요
→ meta의 Decorator

한 Story에만 필요
→ 개별 Story의 Decorator
```

## 8. SeverityBadge Story: 상태 비교

`SeverityBadge`는 `IncidentSeverity`를 받아 내부에서 `Badge`의 tone과 문구로 변환한다.

```txt
low      → info
medium   → warning
high     → danger
critical → danger
```

`Playground`에서는 Controls로 심각도를 하나씩 바꾼다. `AllSeverities`에서는 네 가지 심각도를 동시에 렌더링해 매핑 결과를 비교한다.

```tsx
<SeverityBadge severity="low" />
<SeverityBadge severity="medium" />
<SeverityBadge severity="high" />
<SeverityBadge severity="critical" />
```

## 9. X-Ray Story: 상태와 상호작용

`BoxLayers`는 `app`, `feature`, `shared` 계층의 테두리와 라벨 색상을 비교한다.

`ToggleDemo`는 Story 내부의 React state로 X-Ray를 켜고 끈다.

```txt
enabled = false
→ X-Ray: Off
→ XRayBox는 자식만 반환

버튼 클릭
→ setEnabled(true)
→ React 재렌더링
→ XRayBox 테두리와 출처 라벨 표시
→ aria-pressed="true"
```

실제 `XRayToggle`은 `aria-label`, `aria-pressed`, `type="button"`을 사용해 접근 가능한 토글 버튼으로 구현되어 있다.

## 10. `play`: 상호작용 테스트

`ToggleDemo`는 렌더링 후 `play` 함수를 실행한다.

```ts
play: async ({ canvas, userEvent }) => {
  const toggle = canvas.getByRole("button", {
    name: "X-Ray mode",
  });

  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await userEvent.click(toggle);
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(
    canvas.getByText("widget/incident/IncidentSummaryCard"),
  ).toBeVisible();
},
```

```txt
canvas
→ 현재 Story가 렌더링된 DOM 검색 범위

userEvent
→ 실제 사용자와 유사한 클릭, 입력, 키보드 조작

expect
→ 상호작용 전후 결과 검증
```

요소는 가능하면 사용자가 인식하는 접근성 정보로 찾는다.

```txt
우선: getByRole, getByLabelText
마지막 수단: getByTestId
```

현재 테스트는 버튼의 초기 상태, 클릭 후 상태, X-Ray 라벨 표시를 검증한다.

## 11. 정적 빌드 검증

```bash
npm run build-storybook
npm run typecheck
```

정적 빌드가 성공하면 루트의 `storybook-static`에 HTML, JavaScript, CSS 결과가 생성된다.

```txt
npm run storybook
→ 사람이 개발 중 조작하며 확인

npm run build-storybook
→ 모든 Story를 정적 결과로 만들 수 있는지 검증
```

Storybook 빌드 성공은 공용 UI를 독립적으로 렌더링할 수 있다는 증명이다. Next.js 페이지, 실제 API 연결, 전체 사용자 흐름까지 정상이라는 뜻은 아니다.

## 12. 새 컴포넌트에 Story 추가하기

예를 들어 `packages/ui/src/button.tsx`가 생기면 같은 디렉터리에 `button.stories.tsx`를 만든다.

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";

const meta = {
  title: "Shared UI/Button",
  component: Button,
  args: {
    children: "확인",
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
```

파일명이 `.stories.tsx`로 끝나므로 `main.ts`가 자동으로 찾는다. 별도 중앙 등록 파일은 필요하지 않다.

## 13. Addon 확장 방법

Addon은 Storybook에 문서, 접근성, 테스트 같은 기능을 추가한다. 필요한 기능이 생겼을 때만 설치한다.

공식 설치 명령은 다음 형태다.

```bash
npx storybook add <addon-package>
```

이 명령은 패키지를 설치하고 `.storybook/main.ts`의 `addons` 설정을 갱신한다.

### 접근성 검사

```bash
npx storybook add @storybook/addon-a11y
```

렌더링된 DOM을 axe-core 규칙으로 검사해 라벨, ARIA, 색상 대비 같은 기본 접근성 문제를 찾는다. 자동 검사만으로 모든 접근성 문제를 잡을 수 없으므로 키보드 조작과 화면 읽기 흐름도 별도로 확인한다.

### 컴포넌트 테스트 자동화

현재 Storybook은 Vite 기반이므로 Vitest addon을 사용할 수 있다.

```bash
npx storybook add @storybook/addon-vitest
```

설치 후 각 Story의 렌더링과 `play` 상호작용 테스트를 Storybook UI, 터미널, CI에서 실행할 수 있다.

### 자동 문서

컴포넌트 API 문서가 필요할 때 추가한다.

```bash
npx storybook add @storybook/addon-docs
```

meta에 `autodocs` 태그를 적용하면 props와 Story를 기반으로 문서 화면을 생성할 수 있다.

```ts
const meta = {
  component: Badge,
  tags: ["autodocs"],
} satisfies Meta<typeof Badge>;
```

### API 요청 Mock

API를 직접 호출하는 컴포넌트를 Storybook에 추가할 때는 실제 서버 대신 MSW로 응답을 고정할 수 있다.

```bash
npm install --save-dev msw msw-storybook-addon
```

대표 Story는 다음과 같다.

```txt
Loading
Success
Empty
ServerError
Unauthorized
```

현재 `Badge`, `SeverityBadge`, `XRay`는 API를 호출하지 않으므로 MSW는 필요하지 않다.

### 시각 회귀 테스트

Story별 스크린샷을 이전 결과와 비교하면 CSS 변경으로 생긴 시각 회귀를 찾을 수 있다. 팀 단위 UI 변경과 PR 검증이 많아질 때 Chromatic 같은 시각 테스트 서비스를 추가한다.

## 14. 좋은 Story의 기준

컴포넌트마다 실제로 존재하는 상태만 Story로 남긴다.

```txt
기본 상태
주요 변형
비활성 상태
로딩 상태
빈 상태
오류 상태
긴 텍스트
최소·최대 데이터
상호작용 후 상태
```

Story 작성 원칙은 다음과 같다.

```txt
실제 API, 현재 시간, 난수에 의존하지 않음
args로 가능한 상태를 별도 컴포넌트로 복제하지 않음
같은 상태의 Story를 중복 생성하지 않음
사용자 의미가 드러나는 Story 이름 사용
상호작용 요소는 접근성 역할과 이름으로 검색
Story 사이에 상태를 공유하지 않음
Story 파일을 실제 애플리케이션 코드에서 import하지 않음
CI에서 typecheck와 build-storybook 실행
```

## 15. 학습 순서

```txt
1. Badge Playground에서 tone과 children 변경
2. CriticalIncident에서 고정 args와 Controls 확인
3. Tones에서 Decorator와 여러 상태 비교
4. SeverityBadge에서 도메인 값과 UI 매핑 확인
5. ToggleDemo에서 state와 play 실행 확인
6. addon-a11y로 접근성 검사
7. addon-vitest로 Story 테스트 자동화
8. addon-docs로 컴포넌트 문서 생성
9. API 컴포넌트가 생기면 MSW로 응답 상태 분리
10. build-storybook을 CI에 연결
```

## 최종 흐름

```txt
공용 React 컴포넌트 작성
→ 같은 위치에 *.stories.tsx 작성
→ main.ts가 Story 자동 수집
→ preview.ts가 실제 CSS와 전역 설정 적용
→ args와 Controls로 상태 조작
→ Decorator로 필요한 실행 환경 제공
→ play로 사용자 상호작용 검증
→ 필요한 addon만 추가
→ build-storybook과 CI로 회귀 방지
```

공식 참고 문서:

- [Storybook main 설정](https://storybook.js.org/docs/api/main-config/main-config)
- [Args](https://storybook.js.org/docs/writing-stories/args)
- [Controls](https://storybook.js.org/docs/essentials/controls)
- [Decorators](https://storybook.js.org/docs/writing-stories/decorators)
- [Interaction tests](https://storybook.js.org/docs/writing-tests/interaction-testing)
- [Accessibility tests](https://storybook.js.org/docs/writing-tests/accessibility-testing)
- [Vitest addon](https://storybook.js.org/docs/writing-tests/integrations/vitest-addon)
