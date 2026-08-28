// 진입점 — 초기화, 입력, 게임 루프, 상태 전환.
// 세계를 만드는 일은 world/ 가, 그리는 일은 render/ 가, 결말 판정은 game/ 이 한다.

import {
  TILE, PLAYER, CAMERA, RENDER, KEYS, UI, GAME, BUILDING, INTERIOR, IN, SEED,
} from './config.js';
import { WORLD_PX_W, WORLD_PX_H, project, pathBounds } from './world/geo.js';
import { buildBuildings, doorOutside, floorLabel, floorUse } from './world/buildings.js';
import { WorldMap, buildOverview } from './world/map.js';
import { makeInterior, floorList } from './world/interior.js';
import { Actors } from './world/actors.js';
import { Traffic } from './world/traffic.js';
import { Camera } from './render/camera.js';
import { Scene } from './render/scene.js';
import { UI_COLOR } from './render/palette.js';
import { drawBuildingLabels, drawRoomLabels, drawText } from './ui/labels.js';
import { drawHud, bakeOverview, panel } from './ui/hud.js';
import { drawEnding, drawGallery } from './ui/ending.js';
import { drawWorldMap, buildMapMarks, pickOnMap } from './ui/worldmap.js';
import { toggleFullscreen, onFullscreenChange } from './ui/fullscreen.js';
import { TouchControls, isTouchDevice } from './ui/touch.js';
import { GameState } from './game/state.js';
import { GIZMOS, indexIndoorGizmos, outdoorGizmos } from './game/gizmos.js';
import { evaluateEnding } from './game/endings.js';

const S = TILE.size;
const state = {
  mode: 'outdoor',
  player: { x: 0, y: 0, dir: 'down', moving: false, anim: 0 },
  prompt: '', toasts: [],
  showHelp: true, showMinimap: true, showGallery: false, showWorldMap: false,
  interior: null, interiorGizmos: [], floor: 1, exitCooldown: 0,
  picker: null, placeName: '', startPos: { x: 0, y: 0 },
};

const keys = new Set();
let canvas, ctx, cam, map, buildings, scene, actors, traffic, minimap, indoorIndex, touch;
let lastTime = 0;

// ── 초기화 ──────────────────────────────────────────────────────────────
function init() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;

  buildings = buildBuildings();
  map = new WorldMap(buildings);
  scene = new Scene(map, buildings);
  actors = new Actors(map);
  state.actors = actors;   // 그리는 쪽에서도 쓴다
  traffic = new Traffic();
  state.traffic = traffic;
  cam = new Camera();
  state.game = new GameState();
  indoorIndex = indexIndoorGizmos();

  // 길 위의 물건들을 걸어갈 수 있는 칸에 앉힌다
  state.outdoorGizmos = outdoorGizmos().map((g) => {
    const [tx, ty] = project([g.at.lon, g.at.lat]);
    const spot = nearestWalkable(Math.round(tx), Math.round(ty));
    return { ...g, tx: spot.x, ty: spot.y };
  });

  // 목적지 — 양촌공단 한가운데
  const goalRegion = map.regions.find((r) => GAME.goalRegions.includes(r.id));
  const gb = pathBounds(goalRegion.path);
  state.goalPoint = {
    x: ((gb.minX + gb.maxX) / 2) * S,
    y: ((gb.minY + gb.maxY) / 2) * S,
  };
  // 기본 목적지 표시는 오늘의 목표 — 지도에서 다른 곳을 찍으면 그쪽으로 바뀐다
  state.waypoint = {
    tx: state.goalPoint.x / S, ty: state.goalPoint.y / S, label: GAME.goalName,
  };
  state.cameraRef = cam;

  // 출발점 — 구래역 앞. 역을 못 찾으면 좌표로 떨어진다.
  const startBuilding = buildings.list.find((b) => b.name === PLAYER.startPlace);
  const startTile = startBuilding
    ? doorOutside(startBuilding)
    : nearestWalkable(...project([PLAYER.startLon, PLAYER.startLat]).map(Math.round));
  const start = nearestWalkable(startTile.x, startTile.y);
  state.startPos = { x: start.x * S + S / 2, y: start.y * S + S / 2 };
  state.player.x = state.startPos.x;
  state.player.y = state.startPos.y;

  minimap = bakeOverview(buildOverview(map, UI.minimapScale));
  state.minimap = minimap;
  const marks = buildMapMarks(map, buildings);
  state.mapRegions = marks.regions;
  state.landmarks = marks.landmarks;

  window.addEventListener('resize', resize);
  onFullscreenChange(resize);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('pointerdown', (e) => {
    if (state.showHelp) { state.showHelp = false; return; }
    if (state.showWorldMap) {
      const rect = canvas.getBoundingClientRect();
      const hit = pickOnMap(state, e.clientX - rect.left, e.clientY - rect.top);
      if (hit) {
        state.waypoint = hit;
        toast(`목적지: ${hit.label}`);
      }
      return;
    }
  });

  // 모바일이면 터치 조작을 붙인다 (PC 는 키보드 그대로)
  if (isTouchDevice()) {
    state.isTouch = true;
    touch = new TouchControls({
      interact: () => interact(),
      worldmap: () => { state.showWorldMap = !state.showWorldMap; },
      help: () => { state.showHelp = !state.showHelp; },
    });
    state.touch = touch;
    cam.setZoom(3, window.innerWidth, window.innerHeight);   // 작은 화면에서는 더 크게
    bindTouchEvents();
  }

  // 전체화면 버튼 (키보드 없는 환경용)
  const fsButton = document.getElementById('fs');
  if (fsButton) {
    fsButton.addEventListener('click', () => toggleFullscreen(document.documentElement));
  }
  const boot = document.getElementById('boot');
  if (boot) boot.remove();

  exposeDebugHandle();
  resize();
  cam.snap(state.player.x, state.player.y);
  requestAnimationFrame(loop);
}

// 지도 밖이나 벽이면 근처의 걸을 수 있는 칸을 찾는다 (나선 탐색)
function nearestWalkable(tx, ty) {
  if (!map.isSolid(tx, ty)) return { x: tx, y: ty };
  for (let r = 1; r < 40; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        if (!map.isSolid(tx + dx, ty + dy)) return { x: tx + dx, y: ty + dy };
      }
    }
  }
  return { x: tx, y: ty };
}

// 터치 입력 — 화면을 반으로 나눠 왼쪽은 이동, 오른쪽은 버튼
function bindTouchEvents() {
  const pos = (e) => {
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    const [x, y] = pos(e);
    // 대화창이 열려 있으면 그쪽이 먼저
    if (handleTouchUi(x, y)) { e.preventDefault(); return; }
    touch.onDown(e.pointerId, x, y, window.innerWidth);
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') return;
    const [x, y] = pos(e);
    touch.onMove(e.pointerId, x, y);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
    canvas.addEventListener(type, (e) => touch.onUp(e.pointerId));
  }
}

// 열려 있는 화면(도움말·지도·층 선택·결말)에서의 터치 처리
function handleTouchUi(x, y) {
  if (state.showHelp) { state.showHelp = false; return true; }
  if (state.game.ending) { restart(); return true; }
  if (state.showGallery) { state.showGallery = false; return true; }
  if (state.showWorldMap) {
    const hit = pickOnMap(state, x, y);
    if (hit) { state.waypoint = hit; toast(`목적지: ${hit.label}`); }
    else state.showWorldMap = false;
    return true;
  }
  if (state.picker) {
    const hit = pickerRowAt(x, y);
    if (hit === null) state.picker = null;
    else { changeFloor(state.picker.floors[hit]); state.picker = null; }
    return true;
  }
  return false;
}

function resize() {
  const dpr = Math.min(RENDER.maxDpr, window.devicePixelRatio || 1);
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  cam.resize(w, h);
}

// ── 입력 ────────────────────────────────────────────────────────────────
function onKeyDown(e) {
  if (e.repeat) { keys.add(e.code); return; }
  keys.add(e.code);

  if (KEYS.fullscreen.includes(e.code)) { toggleFullscreen(document.documentElement); e.preventDefault(); return; }
  if (KEYS.worldmap.includes(e.code)) {
    state.showWorldMap = !state.showWorldMap;
    e.preventDefault();
    return;
  }
  if (KEYS.map.includes(e.code)) {
    // 전체지도가 열려 있으면 M 은 그걸 닫는다
    if (state.showWorldMap) state.showWorldMap = false;
    else state.showMinimap = !state.showMinimap;
    return;
  }
  if (KEYS.help.includes(e.code)) { state.showHelp = !state.showHelp; return; }
  if (e.code === 'KeyL') { state.showGallery = !state.showGallery; return; }
  if (e.code === 'KeyG') {
    // 목적지를 오늘의 목표로 되돌린다
    state.waypoint = { tx: state.goalPoint.x / S, ty: state.goalPoint.y / S, label: GAME.goalName };
    toast(`목적지: ${GAME.goalName}`);
    return;
  }
  if (KEYS.zoomIn.includes(e.code)) { cam.setZoom(cam.zoom + 1, window.innerWidth, window.innerHeight); return; }
  if (KEYS.zoomOut.includes(e.code)) { cam.setZoom(cam.zoom - 1, window.innerWidth, window.innerHeight); return; }
  if (e.code === 'Escape') {
    state.picker = null; state.showGallery = false;
    state.showHelp = false; state.showWorldMap = false;
    return;
  }

  if (state.game.ending) {
    if (e.code === 'KeyR') restart();
    return;
  }
  if (state.showHelp) { state.showHelp = false; return; }

  if (state.picker) {
    if (KEYS.up.includes(e.code)) state.picker.index = Math.max(0, state.picker.index - 1);
    else if (KEYS.down.includes(e.code)) {
      state.picker.index = Math.min(state.picker.floors.length - 1, state.picker.index + 1);
    } else if (KEYS.interact.includes(e.code)) {
      changeFloor(state.picker.floors[state.picker.index]);
      state.picker = null;
    }
    e.preventDefault();
    return;
  }

  if (KEYS.interact.includes(e.code)) { interact(); e.preventDefault(); }
}

function axis(negKeys, posKeys) {
  const neg = negKeys.some((k) => keys.has(k));
  const pos = posKeys.some((k) => keys.has(k));
  return (pos ? 1 : 0) - (neg ? 1 : 0);
}

// ── 루프 ────────────────────────────────────────────────────────────────
function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  state.dt = dt;              // 그리는 쪽에서 부드러운 전환에 쓴다
  const g = state.game;
  if (g.ending) return;
  if (state.showHelp || state.showGallery || state.picker || state.showWorldMap) return;

  g.tick(dt);
  if (state.exitCooldown > 0) state.exitCooldown -= dt;

  movePlayer(dt);

  if (state.mode === 'outdoor') {
    const view = cam.visibleTiles(2);
    const c0x = Math.floor(view.x0 / TILE.chunk), c1x = Math.floor(view.x1 / TILE.chunk);
    const c0y = Math.floor(view.y0 / TILE.chunk), c1y = Math.floor(view.y1 / TILE.chunk);
    actors.ensure(c0x, c0y, c1x, c1y);
    actors.update(dt, c0x, c0y, c1x, c1y);
    traffic.update(dt, state.player);
    cam.follow(state.player.x, state.player.y, dt);
    updatePlaceName();
    checkGoal();
  } else {
    cam.follow(state.player.x, state.player.y, dt,
      { w: state.interior.w * S, h: state.interior.h * S });
    state.placeName = `${state.interiorBuilding.name} · ${floorLabel(state.floor)}`;
  }

  updatePrompt();

  for (const t of state.toasts) t.life -= dt;
  state.toasts = state.toasts.filter((t) => t.life > 0);
}

function movePlayer(dt) {
  const p = state.player;
  let dx = axis(KEYS.left, KEYS.right);
  let dy = axis(KEYS.up, KEYS.down);
  if (touch && (touch.axis.x || touch.axis.y)) {   // 터치 조이스틱
    dx = touch.axis.x;
    dy = touch.axis.y;
  }
  p.moving = dx !== 0 || dy !== 0;
  if (!p.moving) return;

  const running = KEYS.run.some((k) => keys.has(k)) || (touch && touch.running);
  const speed = PLAYER.walkSpeed * (running ? PLAYER.runMultiplier : 1);
  const len = Math.hypot(dx, dy) || 1;
  const vx = (dx / len) * speed * dt, vy = (dy / len) * speed * dt;

  if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 'right' : 'left';
  else if (dy !== 0) p.dir = dy > 0 ? 'down' : 'up';

  p.anim += dt * (running ? 1.6 : 1);

  if (!blocked(p.x + vx, p.y)) p.x += vx;
  if (!blocked(p.x, p.y + vy)) p.y += vy;
}

// 발밑 상자로 충돌을 본다
function blocked(x, y) {
  const hw = PLAYER.width / 2, hh = PLAYER.height;
  const corners = [
    [x - hw, y - hh], [x + hw, y - hh], [x - hw, y], [x + hw, y],
  ];
  for (const [cx, cy] of corners) {
    const tx = Math.floor(cx / S), ty = Math.floor(cy / S);
    if (state.mode === 'interior') {
      if (state.interior.isSolid(tx, ty)) return true;
    } else if (map.isSolid(tx, ty)) return true;
  }
  return false;
}

// ── 상호작용 ────────────────────────────────────────────────────────────
function nearestOutdoorTarget() {
  const p = state.player;
  const ptx = Math.floor(p.x / S), pty = Math.floor(p.y / S);

  // 물건
  for (const g of state.outdoorGizmos) {
    const d = Math.hypot((g.tx + 0.5) * S - p.x, (g.ty + 0.5) * S - p.y);
    if (d < GAME.interactRadius && !(g.once && state.game.used.has(g.id))) {
      return { type: 'gizmo', gizmo: g, label: g.name };
    }
  }
  // 고양이
  const cat = actors.nearestCat(p.x, p.y, GAME.petRadius);
  if (cat && !state.game.used.has('cat:' + cat.id)) {
    return { type: 'cat', cat, label: '고양이' };
  }
  // 건물 출입구
  let best = null, bestD = BUILDING.enterRadius;
  for (const b of buildings.index.query(ptx - 3, pty - 3, ptx + 3, pty + 3)) {
    const d = Math.hypot((b.door.x + 0.5) * S - p.x, (b.door.y + 0.5) * S - p.y);
    if (d < bestD) { bestD = d; best = b; }
  }
  if (best && state.exitCooldown <= 0) {
    return { type: 'enter', building: best, label: best.name };
  }
  return null;
}

function nearestInteriorTarget() {
  const p = state.player;
  const tx = Math.floor(p.x / S), ty = Math.floor(p.y / S);
  const it = state.interior;

  for (const g of state.interiorGizmos) {
    const d = Math.hypot((g.tx + 0.5) * S - p.x, (g.ty + 0.5) * S - p.y);
    if (d < GAME.interactRadius && !(g.once && state.game.used.has(g.id))) {
      return { type: 'gizmo', gizmo: g, label: g.name };
    }
  }
  const here = it.tileAt(tx, ty);
  if (here === IN.EXIT) return { type: 'exit', label: '나가기' };
  if (here === IN.STAIR_UP) return { type: 'stair', delta: 1, label: '올라가기' };
  if (here === IN.STAIR_DOWN) return { type: 'stair', delta: -1, label: '내려가기' };
  if (here === IN.ELEVATOR) return { type: 'elevator', label: '엘리베이터' };
  return null;
}

function updatePrompt() {
  const t = state.mode === 'outdoor' ? nearestOutdoorTarget() : nearestInteriorTarget();
  state.target = t;
  if (!t) { state.prompt = ''; return; }
  const verb = t.type === 'enter' ? '들어가기'
    : t.type === 'exit' ? '나가기'
    : t.type === 'cat' ? '쓰다듬기'
    : t.type === 'stair' ? t.label
    : t.type === 'elevator' ? '층 고르기'
    : '만지기';
  state.prompt = `Space  ${verb} — ${t.label}`;
}

function interact() {
  const t = state.target;
  if (!t) return;
  switch (t.type) {
    case 'enter': return enterBuilding(t.building);
    case 'exit': return exitBuilding();
    case 'stair': return changeFloor(nextFloor(state.floor, t.delta));
    case 'elevator': return openPicker();
    case 'cat': return petCat(t.cat);
    case 'gizmo': return useGizmo(t.gizmo);
  }
}

function petCat(cat) {
  state.game.used.add('cat:' + cat.id);
  state.game.bump('cat');
  state.game.set('cat_' + state.game.count('cat'), '고양이를 쓰다듬었다');
  toast(`고양이를 쓰다듬었다 (${state.game.count('cat')})`);
  checkImmediateEnding();
}

function useGizmo(g) {
  const ctxObj = {
    toast,
    rideTo: (stationName) => rideTo(stationName),
  };
  state.game.used.add(g.id);
  g.effect(state.game, ctxObj);
  toast(g.text);
  checkImmediateEnding();
}

function toast(text) {
  state.toasts.unshift({ text, life: UI.toastSeconds });
  if (state.toasts.length > 3) state.toasts.pop();
}

// ── 건물 출입 · 층 이동 ─────────────────────────────────────────────────
function enterBuilding(b) {
  state.interiorBuilding = b;
  const floors = floorList(b);
  setFloor(b, floors.includes(1) ? 1 : floors[0], 'spawn');
  state.mode = 'interior';
  cam.snap(state.player.x, state.player.y, { w: state.interior.w * S, h: state.interior.h * S });
  toast(`${b.name} · ${floorLabel(state.floor)}`);
}

function setFloor(b, floor, place) {
  state.floor = floor;
  state.interior = makeInterior(b, floor);
  state.interiorGizmos = (indoorIndex.get(`${b.name}|${floor}`) || []).map((g, i) => {
    const slot = state.interior.slots[(g.at.slot + i) % Math.max(1, state.interior.slots.length)]
      || state.interior.spawn;
    return { ...g, tx: slot.x, ty: slot.y };
  });

  let spot;
  if (place === 'spawn') spot = state.interior.spawn;
  else if (place === 'up') spot = below(state.interior.stairs.down || state.interior.stairs.elevator);
  else if (place === 'down') spot = below(state.interior.stairs.up || state.interior.stairs.elevator);
  else spot = below(state.interior.stairs.elevator) || state.interior.spawn;
  state.player.x = (spot.x + 0.5) * S;
  state.player.y = (spot.y + 0.9) * S; // 타일 경계에 딱 걸치지 않게 (발밑 기준)
}

function below(pos) {
  return pos ? { x: pos.x, y: pos.y + 1 } : null;
}

function nextFloor(floor, delta) {
  const floors = floorList(state.interiorBuilding);
  const i = floors.indexOf(floor);
  return floors[Math.max(0, Math.min(floors.length - 1, i + delta))];
}

function changeFloor(floor) {
  if (floor === state.floor) return;
  const dir = floor > state.floor ? 'up' : 'down';
  setFloor(state.interiorBuilding, floor, dir);
  cam.snap(state.player.x, state.player.y, { w: state.interior.w * S, h: state.interior.h * S });
  toast(`${state.interiorBuilding.name} · ${floorLabel(floor)}`);
}

function openPicker() {
  // 전기를 끊어 놓고 엘리베이터를 타면 갇힌다
  if (state.game.has('blackout')) {
    state.game.set('stuck', '정전 중에 엘리베이터를 탔다');
    toast('버튼을 누르자 안내판이 꺼졌다.');
    checkImmediateEnding();
    return;
  }
  const floors = floorList(state.interiorBuilding);
  state.picker = { floors, index: Math.max(0, floors.indexOf(state.floor)) };
}

function exitBuilding() {
  const b = state.interiorBuilding;
  const out = doorOutside(b);
  state.mode = 'outdoor';
  state.player.x = (out.x + 0.5) * S;
  state.player.y = (out.y + 0.7) * S;
  state.interior = null;
  state.interiorGizmos = [];
  state.floor = 1;
  state.exitCooldown = INTERIOR.exitPause;
  cam.snap(state.player.x, state.player.y);
}

// 지하철로 다른 역까지
function rideTo(stationName) {
  const target = buildings.list.find((b) => b.name === stationName);
  if (!target) return;
  const out = doorOutside(target);
  state.mode = 'outdoor';
  state.interior = null;
  state.interiorGizmos = [];
  state.interiorBuilding = null;
  state.floor = 1;
  state.player.x = (out.x + 0.5) * S;
  state.player.y = (out.y + 0.7) * S;
  state.exitCooldown = INTERIOR.exitPause;
  state.game.clock += 4 * 60; // 4분
  cam.snap(state.player.x, state.player.y);
  toast(`${stationName} 도착`);
}

// ── 결말 ────────────────────────────────────────────────────────────────
function updatePlaceName() {
  const tx = Math.floor(state.player.x / S), ty = Math.floor(state.player.y / S);
  state.placeName = map.regionNameAt(tx, ty) || '김포 들녘';
}

function checkGoal() {
  const tx = Math.floor(state.player.x / S), ty = Math.floor(state.player.y / S);
  for (const r of map.regionIndex.queryPoint(tx, ty)) {
    if (!GAME.goalRegions.includes(r.id)) continue;
    if (pointInside(tx, ty, r.path)) { finish('goal'); return; }
  }
}

function pointInside(px, py, path) {
  let inside = false;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    const [xi, yi] = path[i], [xj, yj] = path[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function checkImmediateEnding() { finish('any'); }

function finish(where) {
  if (state.game.ending) return;
  const e = evaluateEnding(state.game, where);
  if (!e) return;
  state.game.ending = e;
  state.game.discover(e.id);
}

function restart() {
  state.game = new GameState();
  state.mode = 'outdoor';
  state.interior = null;
  state.interiorGizmos = [];
  state.interiorBuilding = null;
  state.toasts = [];
  state.showGallery = false;
  state.player.x = state.startPos.x;
  state.player.y = state.startPos.y;
  state.player.dir = 'down';
  cam.snap(state.player.x, state.player.y);
}

// ── 그리기 ──────────────────────────────────────────────────────────────
function draw() {
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = UI_COLOR.sky;
  ctx.fillRect(0, 0, W, H);

  if (state.mode === 'outdoor') {
    scene.drawOutdoor(ctx, cam, state);
    drawBuildingLabels(ctx, cam, map, state.player);
  } else {
    scene.drawInterior(ctx, cam, state);
    drawRoomLabels(ctx, cam, state.interior);
  }

  drawHud(ctx, state);
  if (state.picker) drawPicker();
  if (touch && !state.showWorldMap && !state.showGallery && !state.game.ending) {
    touch.draw(ctx, window.innerWidth, window.innerHeight);
  }
  if (state.showWorldMap) drawWorldMap(ctx, state);
  // 목록을 열면 결말 화면 대신 목록만 보여 준다
  else if (state.showGallery) drawGallery(ctx, state);
  else if (state.game.ending) drawEnding(ctx, state);
}

// 층 선택 대화창의 자리 (터치로 고를 때도 쓴다)
function pickerLayout() {
  const floors = state.picker.floors;
  const rowH = 22;
  const visible = Math.min(floors.length, 12);
  const from = Math.max(0, Math.min(floors.length - visible,
    state.picker.index - Math.floor(visible / 2)));
  const w = 260;
  const h = visible * rowH + 78;
  const x = 40;
  const y = Math.max(20, (window.innerHeight - h) / 2);
  return { floors, rowH, visible, from, w, h, x, y };
}

function pickerRowAt(px, py) {
  const L = pickerLayout();
  if (px < L.x || px > L.x + L.w || py < L.y || py > L.y + L.h) return null;
  const idx = L.from + Math.floor((py - (L.y + 50)) / L.rowH);
  if (idx < 0 || idx >= L.floors.length) return null;
  return idx;
}

function drawPicker() {
  const b = state.interiorBuilding;
  const floors = state.picker.floors;
  const rowH = 22;
  const visible = Math.min(floors.length, 12);
  const from = Math.max(0, Math.min(floors.length - visible,
    state.picker.index - Math.floor(visible / 2)));

  const w = 260;
  const h = visible * rowH + 78;
  const x = 40;
  const y = Math.max(20, (window.innerHeight - h) / 2);

  panel(ctx, x, y, w, h);
  drawText(ctx, b.name, x + 16, y + 26, { size: 14 });
  drawText(ctx, '엘리베이터', x + 16, y + 44, { size: 11, color: UI_COLOR.accent });

  for (let i = from; i < from + visible; i++) {
    const f = floors[i];
    const row = y + 62 + (i - from) * rowH;
    const selected = i === state.picker.index;
    if (selected) {
      ctx.fillStyle = 'rgba(242, 193, 78, 0.16)';
      ctx.fillRect(x + 8, row - 14, w - 16, rowH);
    }
    const here = f === state.floor;
    drawText(ctx, `${here ? '●' : selected ? '▶' : ' '} ${floorLabel(f)}`,
      x + 16, row, { size: 13, color: selected ? UI_COLOR.text : UI_COLOR.textDim });
    drawText(ctx, floorUse(b, f), x + w - 16, row,
      { size: 12, align: 'right', color: selected ? UI_COLOR.accent : UI_COLOR.textDim });
  }

  drawText(ctx, '↑↓ 고르기 · Space 이동 · Esc 닫기', x + w / 2, y + h - 14,
    { size: 11, align: 'center', color: UI_COLOR.textDim });
}

// 개발·점검용 손잡이. 콘솔에서 __gurae 로 세계를 들여다볼 수 있다.
function exposeDebugHandle() {
  if (typeof window === 'undefined') return;
  window.__gurae = {
    state, cam,
    get scene() { return scene; },
    get map() { return map; },
    get buildings() { return buildings; },
    // 타일 좌표로 순간이동 (실외)
    tp(tx, ty) {
      state.mode = 'outdoor';
      state.interior = null;
      state.player.x = (tx + 0.5) * S;
      state.player.y = (ty + 0.7) * S;
      cam.snap(state.player.x, state.player.y);
    },
    // 이름으로 건물 앞까지
    goto(name) {
      const b = buildings.list.find((x) => x.name === name);
      if (!b) return false;
      const out = doorOutside(b);
      window.__gurae.tp(out.x, out.y);
      return true;
    },
    interact,
  };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
