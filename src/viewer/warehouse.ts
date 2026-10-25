import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Snapshot } from '../sim/engine';
import type { Scenario } from '../sim/schema';

export type CameraMode = 'perspective' | 'top' | 'follow';
export interface WarehouseView {
  setCamera(mode: CameraMode): void;
  dispose(): void;
}

export function createWarehouse(
  host: HTMLElement,
  scenario: Scenario,
  onFrame: (wallMilliseconds: number) => Snapshot,
  onError: (message: string) => void,
): WarehouseView {
  const { width, depth } = scenario.layout;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e5e9e6');
  scene.fog = new THREE.Fog('#e5e9e6', 65, 115);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.domElement.setAttribute('aria-label', '3D 창고: 랙, 이동 경로, AMR과 운반 팔레트');
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.tabIndex = 0;
  host.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 180);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 4;
  controls.maxDistance = Math.max(width, depth) * 3;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.target.set(width / 2, 0.8, depth / 2);
  controls.listenToKeyEvents(renderer.domElement);
  let mode: CameraMode = 'perspective';

  scene.add(new THREE.HemisphereLight('#f7fbff', '#a0a38d', 2.3));
  const sun = new THREE.DirectionalLight('#fff4df', 3.1);
  sun.position.set(-8, 30, 13);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 35;
  sun.shadow.camera.bottom = -35;
  sun.shadow.camera.far = 90;
  sun.shadow.normalBias = 0.045;
  sun.target.position.set(width / 2, 0, depth / 2);
  scene.add(sun, sun.target);

  const materials = {
    concrete: new THREE.MeshStandardMaterial({ color: '#c8cdc6', roughness: 0.94 }),
    exterior: new THREE.MeshStandardMaterial({ color: '#d9dfd7', roughness: 1 }),
    wall: new THREE.MeshStandardMaterial({ color: '#f2f1e8', roughness: 0.8 }),
    frame: new THREE.MeshStandardMaterial({ color: '#233c49', roughness: 0.62, metalness: 0.4 }),
    beam: new THREE.MeshStandardMaterial({ color: '#c77435', roughness: 0.6, metalness: 0.25 }),
    shelf: new THREE.MeshStandardMaterial({ color: '#83908d', roughness: 0.85 }),
    cardboard: new THREE.MeshStandardMaterial({ color: '#bd925b', roughness: 1 }),
    cardboardLight: new THREE.MeshStandardMaterial({ color: '#d2b07c', roughness: 1 }),
    tape: new THREE.MeshStandardMaterial({ color: '#d9bd8b', roughness: 1 }),
    wood: new THREE.MeshStandardMaterial({ color: '#9e794d', roughness: 1 }),
    chassis: new THREE.MeshStandardMaterial({ color: '#eff3ef', roughness: 0.35, metalness: 0.24 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#273033', roughness: 0.95 }),
    sensor: new THREE.MeshStandardMaterial({ color: '#263a40', roughness: 0.25 }),
    light: new THREE.MeshStandardMaterial({
      color: '#39d3ca',
      emissive: '#25beb5',
      emissiveIntensity: 0.8,
    }),
    glass: new THREE.MeshStandardMaterial({ color: '#8daeb0', roughness: 0.2, metalness: 0.2 }),
  };
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const box = (
    parent: THREE.Object3D,
    size: [number, number, number],
    position: [number, number, number],
    material: THREE.Material,
    shadow = true,
  ) => {
    const mesh = new THREE.Mesh(cube, material);
    mesh.scale.set(...size);
    mesh.position.set(...position);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  box(
    scene,
    [width + 28, 0.15, depth + 28],
    [width / 2, -0.27, depth / 2],
    materials.exterior,
    false,
  );
  box(scene, [width, 0.2, depth], [width / 2, -0.1, depth / 2], materials.concrete, false);
  const grid = new THREE.GridHelper(width, Math.ceil(width / 2), '#aeb9b2', '#b9c2ba');
  grid.scale.z = depth / width;
  grid.position.set(width / 2, 0.008, depth / 2);
  scene.add(grid);

  // Two cutaway walls preserve visibility from the default camera.
  box(scene, [width, 6, 0.18], [width / 2, 3, -0.1], materials.wall);
  box(scene, [0.18, 6, depth], [-0.1, 3, depth / 2], materials.wall);
  for (let x = 3; x < width; x += 5) {
    box(scene, [3.9, 2.8, 0.08], [x, 3.4, 0.03], materials.glass, false);
    box(scene, [0.08, 2.8, 0.12], [x, 3.4, 0.09], materials.frame, false);
    box(scene, [3.9, 0.08, 0.12], [x, 3.4, 0.09], materials.frame, false);
  }
  for (let z = 3; z < depth; z += 5) {
    box(scene, [0.08, 2.8, 3.9], [0.03, 3.4, z], materials.glass, false);
    box(scene, [0.12, 2.8, 0.08], [0.09, 3.4, z], materials.frame, false);
  }

  for (const rack of scenario.layout.racks) {
    const group = new THREE.Group();
    group.position.set(rack.x, 0, rack.z);
    scene.add(group);
    for (const x of [-rack.width / 2, 0, rack.width / 2])
      for (const z of [-rack.depth / 2, rack.depth / 2])
        box(group, [0.12, rack.height, 0.12], [x, rack.height / 2, z], materials.frame);
    for (let level = 0; level < 3; level++) {
      const y = 0.35 + level * ((rack.height - 0.65) / 3);
      box(group, [rack.width, 0.08, rack.depth], [0, y, 0], materials.shelf);
      for (const z of [-rack.depth / 2, rack.depth / 2])
        box(group, [rack.width, 0.18, 0.1], [0, y - 0.05, z], materials.beam);
      const bays = Math.max(2, Math.floor(rack.width / 1.2));
      for (let bay = 0; bay < bays; bay++) {
        const x = -rack.width / 2 + ((bay + 0.5) * rack.width) / bays;
        const h = 0.65 + ((level + bay) % 3) * 0.12;
        box(
          group,
          [rack.width / bays - 0.16, h, rack.depth * 0.72],
          [x, y + h / 2 + 0.05, 0],
          (bay + level) % 2 ? materials.cardboard : materials.cardboardLight,
        );
        box(group, [0.12, 0.015, rack.depth * 0.73], [x, y + h + 0.06, 0], materials.tape, false);
      }
    }
  }

  const label = (text: string, x: number, z: number, color: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 112;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('브라우저에서 지점 라벨을 생성할 수 없습니다.');
    context.fillStyle = '#f6f8f3';
    context.fillRect(0, 0, 512, 112);
    context.fillStyle = color;
    context.fillRect(0, 0, 10, 112);
    context.fillStyle = '#234239';
    context.font = '500 96px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 256, 56, 460);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    );
    sprite.position.set(x, 2.5, z);
    sprite.scale.set(3.9, 0.85, 1);
    scene.add(sprite);
  };

  const nodes = new Map(scenario.nodes.map((n) => [n.id, n]));
  for (const edge of scenario.edges) {
    const a = nodes.get(edge.from)!;
    const b = nodes.get(edge.to)!;
    const line = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, Math.hypot(b.x - a.x, b.z - a.z), 6),
      new THREE.MeshBasicMaterial({ color: '#f9faf5' }),
    );
    line.position.set((a.x + b.x) / 2, 0.035, (a.z + b.z) / 2);
    line.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize(),
    );
    scene.add(line);
  }
  const pickups = new Set(scenario.tasks.map((t) => t.pickup));
  const dropoffs = new Set(scenario.tasks.map((t) => t.dropoff));
  for (const node of scenario.nodes) {
    const station = pickups.has(node.id) || dropoffs.has(node.id);
    const color = pickups.has(node.id) ? '#d49a34' : dropoffs.has(node.id) ? '#1d9c91' : '#8c9e99';
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(station ? 1.35 : 0.21, station ? 1.43 : 0.28, 48),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(node.x, 0.045, node.z);
    scene.add(marker);
    if (station || node.id === scenario.robot.startNode) label(node.name, node.x, node.z, color);
  }

  const robot = new THREE.Group();
  robot.name = scenario.robot.id;
  scene.add(robot);
  const spec = scenario.robot;
  box(
    robot,
    [spec.width, spec.height * 0.6, spec.length],
    [0, spec.height * 0.65, 0],
    materials.chassis,
  );
  box(robot, [spec.width * 0.9, 0.1, spec.length * 0.92], [0, 0.16, 0], materials.rubber);
  box(
    robot,
    [spec.width * 0.94, 0.035, spec.length * 0.85],
    [0, spec.height + 0.015, 0],
    materials.sensor,
  );
  box(
    robot,
    [spec.width * 0.48, 0.07, 0.06],
    [0, spec.height * 0.68, spec.length / 2 + 0.015],
    materials.light,
  );
  const wheelGeometry = new THREE.CylinderGeometry(0.14, 0.14, 0.09, 18);
  for (const x of [-spec.width * 0.44, spec.width * 0.44])
    for (const z of [-spec.length * 0.31, spec.length * 0.31]) {
      const wheel = new THREE.Mesh(wheelGeometry, materials.rubber);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.14, z);
      wheel.castShadow = true;
      robot.add(wheel);
    }
  const selection = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 0.9, 48),
    new THREE.MeshBasicMaterial({ color: '#22bcb6', side: THREE.DoubleSide }),
  );
  selection.rotation.x = -Math.PI / 2;
  selection.position.y = 0.05;
  robot.add(selection);

  const pallets = new Map<string, THREE.Group>();
  scenario.tasks.forEach((task) => {
    const pallet = new THREE.Group();
    pallet.name = task.id;
    for (const z of [-0.4, 0, 0.4]) box(pallet, [1.05, 0.1, 0.13], [0, 0.09, z], materials.wood);
    for (const x of [-0.43, 0, 0.43]) box(pallet, [0.13, 0.06, 1.05], [x, 0.17, 0], materials.wood);
    box(pallet, [0.92, 0.72, 0.91], [0, 0.56, 0], materials.cardboardLight);
    box(pallet, [0.11, 0.012, 0.92], [0, 0.93, 0], materials.tape, false);
    scene.add(pallet);
    pallets.set(task.id, pallet);
  });

  const activeGeometry = new THREE.BufferGeometry();
  const routePositions = new THREE.BufferAttribute(
    new Float32Array((scenario.nodes.length + 1) * 3),
    3,
  );
  activeGeometry.setAttribute('position', routePositions);
  activeGeometry.setDrawRange(0, 0);
  const activeLine = new THREE.Line(
    activeGeometry,
    new THREE.LineBasicMaterial({ color: '#08bfc0', depthTest: false }),
  );
  activeLine.frustumCulled = false;
  scene.add(activeLine);

  function setCamera(nextMode: CameraMode) {
    mode = nextMode;
    const target =
      nextMode === 'follow' ? robot.position.clone() : new THREE.Vector3(width / 2, 0.8, depth / 2);
    controls.target.copy(target);
    if (nextMode === 'top')
      camera.position.set(width / 2, Math.max(width, depth) * 1.35, depth / 2 + 0.01);
    else if (nextMode === 'follow') camera.position.copy(target).add(new THREE.Vector3(6, 6, 7));
    else camera.position.set(width * 1.1, Math.max(width, depth) * 0.8, depth * 1.6);
    controls.update();
  }
  setCamera('perspective');

  const resize = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const contextLost = (event: Event) => {
    event.preventDefault();
    renderer.setAnimationLoop(null);
    onError('3D 그래픽 연결이 끊겼습니다. 페이지를 새로고침해 다시 실행해 주세요.');
  };
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  let disposed = false;
  renderer.setAnimationLoop((time) => {
    if (disposed) return;
    try {
      const state = onFrame(time);
      robot.position.set(state.robot.x, 0, state.robot.z);
      robot.rotation.y = state.robot.heading;
      for (const [index, item] of state.pallets.entries()) {
        const pallet = pallets.get(item.taskId)!;
        if (item.owner === 'robot') {
          pallet.position.set(state.robot.x, spec.height + 0.04, state.robot.z);
          pallet.rotation.y = state.robot.heading;
        } else {
          const node = nodes.get(item.nodeId!)!;
          pallet.position.set(
            node.x + ((index % 2) - 0.5) * 1.4,
            0.01,
            node.z + (Math.floor(index / 2) - 0.5) * 1.4,
          );
          pallet.rotation.y = 0;
        }
      }
      const route = [{ x: state.robot.x, z: state.robot.z }, ...state.robot.remainingRoute];
      route.forEach((point, i) => routePositions.setXYZ(i, point.x, 0.08, point.z));
      routePositions.needsUpdate = true;
      activeGeometry.setDrawRange(0, route.length);
      if (mode === 'follow') {
        const target = robot.position.clone().add(new THREE.Vector3(0, 0.5, 0));
        camera.position.add(target.clone().sub(controls.target));
        controls.target.copy(target);
      }
      controls.update();
      renderer.render(scene, camera);
      renderer.domElement.dataset.rendererReady = 'true';
      renderer.domElement.dataset.robotX = String(robot.position.x);
      renderer.domElement.dataset.robotZ = String(robot.position.z);
      renderer.domElement.dataset.triangles = String(renderer.info.render.triangles);
      renderer.domElement.dataset.palletOwners = state.pallets.map((p) => p.owner).join(',');
    } catch (error) {
      renderer.setAnimationLoop(null);
      onError(error instanceof Error ? error.message : '3D 화면을 갱신하지 못했습니다.');
    }
  });

  return {
    setCamera,
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      const geometries = new Set<THREE.BufferGeometry>();
      const resources = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.Line ||
          object instanceof THREE.Sprite
        ) {
          geometries.add(object.geometry);
          const list = Array.isArray(object.material) ? object.material : [object.material];
          list.forEach((material) => {
            resources.add(material);
            if ('map' in material && material.map instanceof THREE.Texture)
              textures.add(material.map);
          });
        }
      });
      Object.values(materials).forEach((m) => resources.add(m));
      geometries.forEach((g) => g.dispose());
      resources.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      sun.shadow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
