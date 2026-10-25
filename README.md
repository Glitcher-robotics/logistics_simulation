# Logistics Simulation

**3D 창고에서 AMR·무인지게차의 대수와 운영안을 검토하기 위한 물류 시뮬레이터.**

현재는 개발 하네스 **H0**와 단일 AMR 기준 시나리오가 구현되어 있다. 실제 WebGL 3D 창고에서 로봇이 팔레트를 상차·운반·하차하고, 동일 엔진을 화면 없이 실행해 시간과 거리 계산을 검증한다. 모든 초기 자산은 임의 생성했으며 실제 회사의 도면이나 운영 데이터를 포함하지 않는다.

## 빠른 실행

Node.js **24 LTS 권장**(최소 22.12), pnpm **11.25.0**, WebGL2 지원 브라우저를 사용한다.

```sh
git clone https://github.com/Glitcher-robotics/logistics_simulation.git
cd logistics_simulation
pnpm install --frozen-lockfile
pnpm dev
```

브라우저에서 <http://127.0.0.1:5173>을 연다. pnpm이 설치되지 않았다면 사용하는 Node 설치 도구나 Corepack으로 `package.json`의 `packageManager` 버전을 설치한다. pnpm 실행 버전은 `pnpm --version`으로 확인한다.

1. 마우스로 창고를 회전·확대하거나 `위에서`, `로봇 추적` 관점을 선택한다.
2. `재생` 또는 `10초 전진`으로 공차 이동 → 상차 → 적재 운반 → 하차를 확인한다.
3. 배속·시간 슬라이더는 같은 시뮬레이션 상태를 재생한다. `초기화`로 되돌릴 수 있다.
4. 이동 속도를 적용하면 시나리오를 초기화하고 물리적 이동시간을 다시 계산한다.
5. `시나리오 열기/저장`은 검증된 JSON을 사용한다. `전체 실행 결과 JSON`은 마지막 작업까지 계산한 보고서를 저장한다.

## 하네스 사용

```sh
pnpm doctor                    # 환경과 의존성 확인
pnpm check                     # 정적 검사, 포맷, 타입, 테스트, 빌드, 기준 시나리오
pnpm exec playwright install chromium
pnpm test:e2e                  # 실제 WebGL 3D 화면과 사용자 흐름
pnpm scenario:run               # artifacts/single-amr-report.json
pnpm scenario:run --scenario scenarios/single-amr.json --out artifacts/run.json
```

코드 포맷은 `pnpm format`, 개발 중 테스트는 `pnpm test:watch`, 프로덕션 미리보기는 `pnpm build` 후 `pnpm preview`를 사용한다. CI도 같은 검사 명령을 실행한다.

기준 시나리오는 32 × 24 m 가상 창고, 랙 5개, AMR 1대, 운반 작업 3건이다. 독립 계산한 최종값은 **이동 146 m, 하차 완료 3건, 마지막 완료 142.666666…초**다. 작은 시간 간격 전진, 직접 시간 이동, 브라우저 배속과 headless 실행이 같은 결과를 내야 한다.

## 구조

```text
src/
  sim/          입력 검증 · 경로 탐색 · 사건 엔진 · 보고서
  viewer/       Three.js 창고와 엔진 스냅샷 표시
  app/          재생 제어 · 파일 입출력 · 화면
scenarios/      합성 입력과 독립 계산한 기준 결과
tests/e2e/      실제 3D 브라우저 검증
scripts/        doctor · check · headless 실행
docs/           제품 목표 · 구조 · 단계별 계획 · 검증
```

개발을 시작할 때 [AGENTS.md](AGENTS.md), [제품 범위](docs/PRODUCT.md), [구조](docs/ARCHITECTURE.md), [계획](docs/PLAN.md), [검증·모델 가정](docs/VALIDATION.md)을 읽는다. 다음 개발 단위와 완료 조건은 계획 문서에 기록한다.

## 현재 해석 범위와 다음 단계

H0는 **단일 AMR, 일정 속도, FIFO, 즉시 방향 전환, 고정 상하차 시간**이다. 랙과 경로에는 AMR 반대각선 기준의 보수적인 간섭 검사를 적용한다. 적재물 형상을 포함한 정밀 회전/충돌 검증은 아니다. 충전과 다중 로봇의 교통 제어도 아직 구현 범위에 포함되지 않는다.

다음은 경로·설비 편집, 다중 AMR의 공유구간 점유, CAD 입력, 한 교대 대수·운영안 비교 순서다. DWG/DXF 가져오기 버튼이나 실제 구현되지 않은 로봇 대수 조절을 현재 화면에 노출하지 않는다. 실공장 생산성 판단 전에는 현장 자료로 모델을 보정해야 한다.
