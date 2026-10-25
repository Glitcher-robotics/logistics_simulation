import { useEffect, useRef, useState } from 'react';
import { ZodError } from 'zod';
import initialScenario from '../../scenarios/single-amr.json';
import type { EventType, RobotPhase, Snapshot } from '../sim/engine';
import { createReport } from '../sim/report';
import { parseScenario, type Scenario } from '../sim/schema';
import { createWarehouse, type CameraMode, type WarehouseView } from '../viewer/warehouse';
import { Playback } from './playback';

const phases: Record<RobotPhase, string> = {
  idle: '대기',
  to_pickup: '상차 지점으로 이동',
  loading: '상차 중',
  to_dropoff: '적재 운반 중',
  unloading: '하차 중',
};
const eventNames: Record<EventType, string> = {
  released: '운반 요청',
  assigned: 'AMR 배정',
  loading: '상차 시작',
  loaded: '상차 완료',
  unloading: '하차 시작',
  delivered: '하차 완료',
};
const number = (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
const time = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(Math.floor(value % 60)).padStart(2, '0')}`;

function download(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.replace(/[<>:"/\\|?*]/g, '-');
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function App() {
  const [scenario, setScenario] = useState(() => parseScenario(initialScenario));
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const replaceScenario = (next: Scenario) => {
    setScenario(parseScenario(next));
    setRevision((n) => n + 1);
    setError('');
  };

  return (
    <div className="application">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            L
          </span>
          <div>
            <strong>LOGISTICS LAB</strong>
            <span>공간에서 검토하는 물류 운영</span>
          </div>
        </div>
        <span className="scope-tag">H0 · 단일 AMR</span>
        <div className="header-actions">
          <button type="button" onClick={() => fileRef.current?.click()}>
            시나리오 열기
          </button>
          <button type="button" onClick={() => download(scenario, `${scenario.id}.json`)}>
            시나리오 저장
          </button>
          <input
            ref={fileRef}
            aria-label="시나리오 JSON 파일"
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (!file) return;
              try {
                if (file.size > 1_000_000)
                  throw new Error('시나리오는 1 MB 이하 JSON 파일이어야 합니다.');
                replaceScenario(parseScenario(JSON.parse(await file.text())));
              } catch (cause) {
                setError(
                  cause instanceof ZodError
                    ? cause.issues
                        .slice(0, 3)
                        .map((i) => `${i.path.join('.') || '시나리오'}: ${i.message}`)
                        .join(' / ')
                    : cause instanceof Error
                      ? cause.message
                      : '시나리오를 불러오지 못했습니다.',
                );
              }
            }}
          />
        </div>
      </header>
      {error && (
        <div className="input-error" role="alert">
          시나리오 오류 · {error}
          <button type="button" onClick={() => setError('')}>
            닫기
          </button>
        </div>
      )}
      <Workspace key={revision} scenario={scenario} onReplace={replaceScenario} />
    </div>
  );
}

function Workspace({
  scenario,
  onReplace,
}: {
  scenario: Scenario;
  onReplace: (value: Scenario) => void;
}) {
  const [runtime] = useState(() => new Playback(scenario));
  const [snapshot, setSnapshot] = useState(() => runtime.snapshot());
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [cameraMode, setCameraMode] = useState<CameraMode>('perspective');
  const [travelSpeed, setTravelSpeed] = useState(scenario.robot.speed);
  const [graphicsError, setGraphicsError] = useState('');
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<WarehouseView | null>(null);

  useEffect(() => {
    if (!host.current) return;
    let lastPublish = -Infinity;
    let lastPhase = '';
    let lastPublishedTime = -1;
    try {
      viewer.current = createWarehouse(
        host.current,
        scenario,
        (wallTime) => {
          const next = runtime.update(wallTime);
          if (
            (next.time !== lastPublishedTime && wallTime - lastPublish >= 100) ||
            next.robot.phase !== lastPhase
          ) {
            lastPublish = wallTime;
            lastPhase = next.robot.phase;
            lastPublishedTime = next.time;
            setSnapshot(next);
            setRunning(runtime.running);
          }
          return next;
        },
        setGraphicsError,
      );
    } catch (error) {
      setGraphicsError(
        error instanceof Error ? error.message : 'WebGL2 화면을 초기화하지 못했습니다.',
      );
    }
    return () => {
      viewer.current?.dispose();
      viewer.current = null;
    };
  }, [runtime, scenario]);

  const publish = (next: Snapshot) => {
    setSnapshot(next);
    setRunning(runtime.running);
  };
  const changeCamera = (mode: CameraMode) => {
    setCameraMode(mode);
    viewer.current?.setCamera(mode);
  };
  const currentTask = scenario.tasks.find((task) => task.id === snapshot.robot.taskId);
  const activeTaskState = snapshot.tasks.find((task) => task.id === snapshot.robot.taskId);
  const nodeName = (id: string) => scenario.nodes.find((node) => node.id === id)?.name ?? id;

  return (
    <main className="workspace">
      <aside className="sidebar">
        <section>
          <div className="eyebrow">SCENARIO</div>
          <h1>가상 창고 운반</h1>
          <p className="secondary">{scenario.name}</p>
          <div className="scene-summary">
            <span>
              창고 {scenario.layout.width} × {scenario.layout.depth} m
            </span>
            <span>랙 {scenario.layout.racks.length}개 · AMR 1대</span>
          </div>
        </section>
        <section>
          <div className="section-heading">
            <h2>선택한 로봇</h2>
            <span className="status-dot" />{' '}
          </div>
          <div className="robot-title">
            <span className="robot-symbol" aria-hidden="true">
              AMR
            </span>
            <div>
              <strong>{scenario.robot.id}</strong>
              <span data-testid="robot-phase">{phases[snapshot.robot.phase]}</span>
            </div>
          </div>
          <dl className="properties">
            <div>
              <dt>적재 상태</dt>
              <dd data-testid="carrying">{snapshot.robot.carrying ?? '공차'}</dd>
            </div>
            <div>
              <dt>위치 x / z</dt>
              <dd>
                {number(snapshot.robot.x)} / {number(snapshot.robot.z)} m
              </dd>
            </div>
            <div>
              <dt>차체 폭 × 길이</dt>
              <dd>
                {scenario.robot.width} × {scenario.robot.length} m
              </dd>
            </div>
            <div>
              <dt>상차 / 하차</dt>
              <dd>
                {scenario.robot.loadSeconds} / {scenario.robot.unloadSeconds}초
              </dd>
            </div>
          </dl>
          <label className="field-label" htmlFor="travel-speed">
            이동 속도 <span>m/s</span>
          </label>
          <div className="field-row">
            <input
              id="travel-speed"
              aria-label="로봇 이동 속도"
              type="number"
              min="0.1"
              max="10"
              step="0.1"
              value={travelSpeed}
              onChange={(e) => setTravelSpeed(Number(e.target.value))}
            />
            <button
              type="button"
              disabled={!Number.isFinite(travelSpeed) || travelSpeed <= 0 || travelSpeed > 10}
              onClick={() =>
                onReplace({ ...scenario, robot: { ...scenario.robot, speed: travelSpeed } })
              }
            >
              적용·초기화
            </button>
          </div>
        </section>
        <section>
          <div className="section-heading">
            <h2>운반 작업</h2>
            <span className="count">
              {snapshot.completedTasks} / {scenario.tasks.length}
            </span>
          </div>
          <ol className="task-list">
            {scenario.tasks.map((task, i) => {
              const state = snapshot.tasks[i]!;
              const label =
                state.status === 'completed'
                  ? '완료'
                  : state.status === 'active'
                    ? '수행 중'
                    : state.status === 'queued'
                      ? '배정 대기'
                      : '예정';
              return (
                <li key={task.id} className={state.status === 'active' ? 'task active' : 'task'}>
                  <div>
                    <strong>{task.id}</strong>
                    <span className={`task-status ${state.status}`}>{label}</span>
                  </div>
                  <p>
                    {nodeName(task.pickup)} → {nodeName(task.dropoff)}
                  </p>
                  <small>
                    요청 {time(task.releaseAt)}
                    {state.completedAt !== null ? ` · 완료 ${time(state.completedAt)}` : ''}
                  </small>
                </li>
              );
            })}
          </ol>
        </section>
        <section className="scope-note">
          <span className="eyebrow">기준 시나리오</span>
          <p>
            일정 속도 · FIFO · 고정 상하차 시간
            <br />
            현재 범위: 단일 AMR 운반
          </p>
        </section>
      </aside>

      <div className="simulation-area">
        <div className="scene-toolbar">
          <div>
            <strong>Warehouse A</strong>
            <span>3D 작업 공간</span>
          </div>
          <div className="camera-controls" aria-label="카메라 관점">
            {(
              [
                ['perspective', '입체'],
                ['top', '위에서'],
                ['follow', '로봇 추적'],
              ] as const
            ).map(([mode, name]) => (
              <button
                type="button"
                key={mode}
                aria-pressed={cameraMode === mode}
                onClick={() => changeCamera(mode)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
        <div className="viewport-wrap">
          <div ref={host} className="viewport" data-testid="warehouse-viewport" />
          {graphicsError && (
            <div className="graphics-error" role="alert">
              <strong>3D 화면 초기화 실패</strong>
              <p>{graphicsError}</p>
              <span>WebGL2를 지원하는 브라우저와 그래픽 설정을 확인해 주세요.</span>
            </div>
          )}
          <div className="viewport-label">
            <span className="live-dot" />
            {snapshot.finished ? '운반 시나리오 완료' : phases[snapshot.robot.phase]}
            <span className="viewport-subtitle">
              {snapshot.robot.id}
              {currentTask ? ` · ${currentTask.id}` : ''}
            </span>
          </div>
          <div className="viewport-help">드래그: 회전 · 휠: 확대 · 우클릭: 이동</div>
          <div className="scene-scale">합성 레이아웃 · 단위 m</div>
        </div>

        <section className="playback-panel" aria-label="시뮬레이션 재생">
          <div className="playback-row">
            <div className="playback-actions">
              <button
                className="primary"
                type="button"
                onClick={() => {
                  if (runtime.running) publish(runtime.pause(performance.now()));
                  else {
                    runtime.play(performance.now());
                    setRunning(true);
                  }
                }}
              >
                {running ? '일시정지' : snapshot.finished ? '다시 재생' : '재생'}
              </button>
              <button type="button" onClick={() => publish(runtime.seek(0))}>
                초기화
              </button>
              <button type="button" onClick={() => publish(runtime.step(10))}>
                10초 전진
              </button>
              <button type="button" onClick={() => publish(runtime.seek(runtime.duration))}>
                끝까지 계산
              </button>
            </div>
            <label className="speed-control">
              배속
              <select
                aria-label="재생 배속"
                value={speed}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  runtime.setSpeed(value, performance.now());
                  setSpeed(value);
                }}
              >
                {[1, 2, 5, 10].map((s) => (
                  <option key={s} value={s}>
                    {s}×
                  </option>
                ))}
              </select>
            </label>
            <output className="clock" data-testid="sim-time">
              {time(snapshot.time)} <span>/ {time(runtime.duration)}</span>
            </output>
          </div>
          <input
            className="timeline"
            type="range"
            aria-label="시뮬레이션 시간"
            min="0"
            max={runtime.duration}
            step="0.1"
            value={snapshot.time}
            onChange={(event) => publish(runtime.seek(Number(event.target.value)))}
          />
          <div className="metric-row" aria-live="polite">
            <span>
              완료{' '}
              <strong data-testid="completed-count">
                {snapshot.completedTasks} / {scenario.tasks.length}
              </strong>
            </span>
            <span>
              배정 대기 <strong>{snapshot.queueLength}건</strong>
            </span>
            <span>
              이동거리 <strong data-testid="distance">{number(snapshot.distanceMetres)} m</strong>
            </span>
            <span>
              {activeTaskState?.assignedAt !== null && activeTaskState?.assignedAt !== undefined
                ? `현재 작업 경과 ${number(snapshot.time - activeTaskState.assignedAt)}초`
                : '로봇 대기'}
            </span>
          </div>
        </section>

        <section className="event-panel">
          <div className="section-heading">
            <h2>운행 이벤트</h2>
            <button
              className="text-button"
              type="button"
              onClick={() => download(createReport(scenario), `${scenario.id}-full-run.json`)}
            >
              전체 실행 결과 JSON ↓
            </button>
          </div>
          <div className="event-list">
            {snapshot.events
              .slice(-5)
              .reverse()
              .map((event, index) => (
                <div className="event" key={`${event.time}-${event.type}-${event.taskId}-${index}`}>
                  <time>{time(event.time)}</time>
                  <span>{event.taskId}</span>
                  <strong>{eventNames[event.type]}</strong>
                </div>
              ))}
          </div>
        </section>
      </div>
    </main>
  );
}
