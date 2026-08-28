// 진입점 — 초기화, 입력, 게임 루프, 상태 전환.
// 세계를 만드는 일은 world/ 가, 그리는 일은 render/ 가, 결말 판정은 game/ 이 한다.

import {
  TILE, PLAYER, CAMERA, RENDER, KEYS, UI, GAME, BUILDING, INTERIOR, IN, SEED, LIFE, PATHING,
} from './config.js';
import { WORLD_PX_W, WORLD_PX_H, project, pathBounds } from './world/geo.js';
import { withJosa } from './util/hangul.js';
import { buildBuildings, doorOutside, floorLabel, floorUse } from './world/buildings.js';
import { WorldMap, buildOverview } from './world/map.js';
import { makeInterior, floorList } from './world/interior.js';
import { pickIndoorEvent, applyEventProps, makeIndoorPeople } from './world/indoor.js';
import { Actors } from './world/actors.js';
import { findPath } from './world/pathing.js';
import { Traffic } from './world/traffic.js';
import { Camera } from './render/camera.js';
import { Scene } from './render/scene.js';
import { UI_COLOR } from './render/palette.js';
import { drawBuildingLabels, drawRoomLabels, drawText } from './ui/labels.js';
import { drawHud, bakeOverview, panel } from './ui/hud.js';
import { drawEnding, drawGallery } from './ui/ending.js';
import { drawWorldMap, buildMapMarks, pickOnMap } from './ui/worldmap.js';
import { drawDialogue, startDialogue, advanceDialogue, moveChoice, pickChoice, choiceRowAt }
  from './ui/dialogue.js';
import { toggleFullscreen, onFullscreenChange } from './ui/fullscreen.js';
import { TouchControls, isTouchDevice } from './ui/touch.js';
import { GameState } from './game/state.js';
import { GIZMOS, indexIndoorGizmos, outdoorGizmos } from './game/gizmos.js';
import { ITEM_BY_ID, itemName } from './game/data/items.js';
import { pickOutcome, encounterFlag } from './game/encounters.js';
import { evaluateEnding } from './game/endings.js';

const S = TILE.size;
const state = {
  mode: 'outdoor',
  player: { x: 0, y: 0, dir: 'down', moving: false, anim: 0 },
  prompt: '', toasts: [],
  showHelp: true, showMinimap: true, showGallery: false, showWorldMap: false,
  interior: null, interiorGizmos: [], floor: 1, exitCooldown: 0,
  indoorPeople: [], indoorEvent: null, dialogue: null,
  picker: null, placeName: '', startPos: { x: 0, y: 0 },
  minimapZoom: UI.minimapZoomDefault,   // 미니맵 축척
  autoPath: null,                        // 자동 이동 중이면 {tiles, index, goal, label}
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
  traffic = new Traffic(map);
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
  // 문 앞이라도 좁은 틈이면 갇힌다 — 넉넉히 돌아다닐 수 있는 자리로 잡는다
  const start = map.openSpot(startTile.x, startTile.y, PLAYER.safeArea);
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
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', (e) => {
    if (touch && e.pointerType !== 'mouse') touch.onMove(e.pointerId, ...pointerPos(e));
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
    canvas.addEventListener(type, (e) => { if (touch) touch.onUp(e.pointerId); });
  }
  // 미니맵 위에서 휠을 굴리면 축척이 바뀐다
  canvas.addEventListener('wheel', (e) => {
    const [x, y] = pointerPos(e);
    if (!inRect(state.minimapRect, x, y)) return;
    zoomMinimap(e.deltaY < 0 ? 1 : -1);
    e.preventDefault();
  }, { passive: false });

  // 모바일이면 터치 조작을 붙인다 (PC 는 키보드 그대로)
  if (isTouchDevice()) {
    state.isTouch = true;
    touch = new TouchControls({
      interact: () => { if (state.dialogue) advanceDialogue(state); else interact(); },
      worldmap: () => { state.showWorldMap = !state.showWorldMap; },
      useItem: () => useItem(),
      help: () => { state.showHelp = !state.showHelp; },
      fullscreen: () => toggleFullscreen(document.documentElement),
    });
    state.touch = touch;
    cam.setZoom(3, window.innerWidth, window.innerHeight);   // 작은 화면에서는 더 크게
  }

  // 전체화면 버튼 (키보드 없는 환경용)
  const fsButton = document.getElementById('fs');
  if (fsButton && state.isTouch) fsButton.style.display = 'none';   // 터치에서는 캔버스 버튼을 쓴다
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

// 화면 좌표 (캔버스 기준)
function pointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
}

function inRect(r, x, y) {
  return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// 미니맵을 눌렀는가 (바깥에서 미니맵이 켜져 있을 때만)
function hitMinimap(x, y) {
  if (!state.showMinimap || state.mode !== 'outdoor') return false;
  return inRect(state.minimapRect, x, y);
}

// 미니맵 축척 — dir 이 +1 이면 가깝게, -1 이면 멀리
function zoomMinimap(dir) {
  const zooms = UI.minimapZooms;
  const i = Math.max(0, zooms.indexOf(state.minimapZoom));
  const next = Math.max(0, Math.min(zooms.length - 1, i + dir));
  if (zooms[next] === state.minimapZoom) return;
  state.minimapZoom = zooms[next];
  const spanM = (UI.minimapSize / state.minimapZoom) * UI.minimapScale * 2.5;
  toast(`미니맵 축척 ×${state.minimapZoom} (가로 ${Math.round(spanM)}m)`);
}

// 포인터 하나로 마우스와 터치를 함께 받는다.
// 순서: 열린 창 → 미니맵 축척 버튼 → 미니맵 → 터치 조작.
function onPointerDown(e) {
  const [x, y] = pointerPos(e);
  const isTouchPointer = e.pointerType !== 'mouse';

  if (handleUiPointer(x, y)) { e.preventDefault(); return; }

  if (state.mode === 'outdoor' && state.showMinimap) {
    const z = state.minimapZoomRects;
    if (z && inRect(z.in, x, y)) { zoomMinimap(1); e.preventDefault(); return; }
    if (z && inRect(z.out, x, y)) { zoomMinimap(-1); e.preventDefault(); return; }
    if (hitMinimap(x, y)) { state.showWorldMap = true; e.preventDefault(); return; }
  }

  if (touch && isTouchPointer) {
    touch.onDown(e.pointerId, x, y, window.innerWidth);
    e.preventDefault();
  }
}

// 열려 있는 화면(도움말·지도·층 선택·결말)에서의 클릭·터치 처리.
// 처리했으면 true — 그러면 이동 조작으로 넘어가지 않는다.
function handleUiPointer(x, y) {
  if (state.dialogue) {
    // 고를 게 있으면 누른 줄을 고른다
    if (state.dialogue.choices) {
      const row = choiceRowAt(state, x, y);
      if (row >= 0) pickChoice(state, row);
      else advanceDialogue(state);
      return true;
    }
    advanceDialogue(state);
    return true;
  }
  if (state.showHelp) { state.showHelp = false; return true; }
  if (state.game.ending) { restart(); return true; }
  if (state.showGallery) {
    // 좌우를 누르면 쪽을 넘기고, 가운데를 누르면 닫는다
    const { w: W } = { w: window.innerWidth };
    if (x < W * 0.25) state.galleryPage = Math.max(0, (state.galleryPage || 0) - 1);
    else if (x > W * 0.75) {
      state.galleryPage = Math.min((state.galleryPages || 1) - 1, (state.galleryPage || 0) + 1);
    } else state.showGallery = false;
    return true;
  }
  if (state.showWorldMap) {
    const hit = pickOnMap(state, x, y);
    if (hit) {
      state.waypoint = hit;
      state.showWorldMap = false;      // 지도를 닫아야 걸어가는 게 보인다
      startAutoWalk(hit);
    } else {
      state.showWorldMap = false;
    }
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
  if (e.code === 'KeyL') { state.showGallery = !state.showGallery; state.galleryPage = 0; return; }
  if (e.code === 'KeyG') {
    // 목적지를 오늘의 목표로 되돌린다
    state.waypoint = { tx: state.goalPoint.x / S, ty: state.goalPoint.y / S, label: GAME.goalName };
    toast(`목적지: ${GAME.goalName}`);
    return;
  }
  if (KEYS.minimapIn.includes(e.code)) { zoomMinimap(1); return; }
  if (KEYS.minimapOut.includes(e.code)) { zoomMinimap(-1); return; }
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
  // 엔딩 목록은 쪽으로 넘긴다
  if (state.showGallery) {
    if (KEYS.left.includes(e.code)) { state.galleryPage = Math.max(0, (state.galleryPage || 0) - 1); return; }
    if (KEYS.right.includes(e.code)) {
      state.galleryPage = Math.min((state.galleryPages || 1) - 1, (state.galleryPage || 0) + 1);
      return;
    }
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

  if (KEYS.useItem.includes(e.code)) { useItem(); e.preventDefault(); return; }

  // 선택지가 떠 있으면 위아래로 고른다
  if (state.dialogue && state.dialogue.choices) {
    if (KEYS.up.includes(e.code)) { moveChoice(state, -1); e.preventDefault(); return; }
    if (KEYS.down.includes(e.code)) { moveChoice(state, 1); e.preventDefault(); return; }
  }

  if (KEYS.interact.includes(e.code)) {
    if (state.dialogue) advanceDialogue(state);
    else interact();
    e.preventDefault();
  }
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
  if (state.dialogue) return;   // 말하는 동안에는 멈춘다

  g.tick(dt);
  if (state.exitCooldown > 0) state.exitCooldown -= dt;

  movePlayer(dt);

  if (state.mode === 'outdoor') {
    const view = cam.visibleTiles(2);
    const c0x = Math.floor(view.x0 / TILE.chunk), c1x = Math.floor(view.x1 / TILE.chunk);
    const c0y = Math.floor(view.y0 / TILE.chunk), c1y = Math.floor(view.y1 / TILE.chunk);
    actors.ensure(c0x, c0y, c1x, c1y);
    actors.update(dt, c0x, c0y, c1x, c1y);
    const pad = 120;
    traffic.update(dt, state.player, {
      left: cam.left - pad, top: cam.top - pad,
      right: cam.left + cam.viewW + pad, bottom: cam.top + cam.viewH + pad,
    });
    cam.follow(state.player.x, state.player.y, dt);
    checkCarHit();
    updatePlaceName();
    noticeOutdoorEvent();
    checkGoal();
  } else {
    cam.follow(state.player.x, state.player.y, dt,
      { w: state.interior.w * S, h: state.interior.h * S });
    state.placeName = `${state.interiorBuilding.name} · ${floorLabel(state.floor)}`;
    // 방 안에 들어서면 그 방은 밝아진다
    const rIdx = state.interior.roomIndexAt(
      Math.floor(state.player.x / S), Math.floor(state.player.y / S));
    if (rIdx >= 0) state.interior.reveal(rIdx);
  }

  updatePrompt();

  for (const t of state.toasts) t.life -= dt;
  state.toasts = state.toasts.filter((t) => t.life > 0);
}

let stuckTime = 0;   // 제자리걸음이 이어진 시간

// ── 자동 이동 ───────────────────────────────────────────────────────────
// 지도에서 찍은 곳까지 알아서 걸어간다. 길은 조금씩 끊어서 찾는다.
function startAutoWalk(target) {
  if (state.mode !== 'outdoor') {
    toast('밖으로 나가야 걸어갈 수 있다.');
    return;
  }
  state.autoPath = {
    goal: { x: Math.round(target.tx), y: Math.round(target.ty) },
    label: target.label || '표시한 곳',
    tiles: [], index: 0, age: PATHING.replanSeconds, still: 0, retries: 0,
  };
  toast(`${withJosa(state.autoPath.label, '으로/로')} 자동 이동 — 움직이면 멈춘다`);
}

function stopAutoWalk(reason) {
  if (!state.autoPath) return;
  if (reason) toast(reason);
  state.autoPath = null;
}

// 자동 이동이 갈 방향을 낸다. 갈 데가 없으면 null.
function autoWalkDir(dt) {
  const auto = state.autoPath;
  const p = state.player;
  const here = { x: Math.floor(p.x / S), y: Math.floor(p.y / S) };
  const distTiles = Math.hypot(auto.goal.x - here.x, auto.goal.y - here.y);
  if (distTiles <= PATHING.arriveTiles) {
    stopAutoWalk(`${auto.label} 도착`);
    return null;
  }

  auto.age += dt;
  // 길이 다 떨어졌거나, 오래됐거나, 제자리면 다시 찾는다
  if (auto.index >= auto.tiles.length || auto.age >= PATHING.replanSeconds
      || auto.still > PATHING.stuckSeconds) {
    auto.tiles = findPath(map, here, auto.goal);
    auto.index = 0;
    auto.age = 0;
    auto.still = 0;
    if (!auto.tiles.length) {
      auto.retries++;
      if (auto.retries >= PATHING.maxRetries) {
        stopAutoWalk('그쪽으로는 길이 없어 멈췄다.');
        return null;
      }
      return null;
    }
    auto.retries = 0;
  }

  // 다음 지점까지 걸어간다
  let target = auto.tiles[auto.index];
  let tx = (target.x + 0.5) * S, ty = (target.y + 0.5) * S;
  while (Math.hypot(tx - p.x, ty - p.y) < PATHING.stepTiles * S
      && auto.index < auto.tiles.length - 1) {
    auto.index++;
    target = auto.tiles[auto.index];
    tx = (target.x + 0.5) * S; ty = (target.y + 0.5) * S;
  }
  const dx = tx - p.x, dy = ty - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function movePlayer(dt) {
  const p = state.player;
  let dx = axis(KEYS.left, KEYS.right);
  let dy = axis(KEYS.up, KEYS.down);
  if (touch && (touch.axis.x || touch.axis.y)) {   // 터치 조이스틱
    dx = touch.axis.x;
    dy = touch.axis.y;
  }
  // 직접 조작하면 자동 이동은 그 자리에서 멈춘다
  if (state.autoPath && (dx !== 0 || dy !== 0)) stopAutoWalk('자동 이동을 멈췄다.');
  if (state.autoPath) {
    const dir = autoWalkDir(dt);
    if (dir) { dx = dir.x; dy = dir.y; }
  }
  p.moving = dx !== 0 || dy !== 0;
  if (!p.moving) { stuckTime = 0; return; }

  const running = KEYS.run.some((k) => keys.has(k)) || (touch && touch.running);
  const speed = PLAYER.walkSpeed * (running ? PLAYER.runMultiplier : 1)
    * (state.game.has('hit') ? PLAYER.hurtSpeed : 1);
  const len = Math.hypot(dx, dy) || 1;
  const vx = (dx / len) * speed * dt, vy = (dy / len) * speed * dt;

  if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 'right' : 'left';
  else if (dy !== 0) p.dir = dy > 0 ? 'down' : 'up';

  p.anim += dt * (running ? 1.6 : 1);

  const beforeX = p.x, beforeY = p.y;
  if (!blocked(p.x + vx, p.y)) p.x += vx;
  if (!blocked(p.x, p.y + vy)) p.y += vy;

  // 갇힘 감시 — 가려는데 제자리면 빼 준다
  const gone = Math.hypot(p.x - beforeX, p.y - beforeY);
  const still = gone <= PLAYER.stuckEpsilon * dt;
  stuckTime = still ? stuckTime + dt : 0;
  if (state.autoPath) state.autoPath.still = still ? state.autoPath.still + dt : 0;
  if (stuckTime > PLAYER.stuckSeconds) { stuckTime = 0; checkTrapped(); }
}

// 제자리걸음이 길어졌다 — 정말 갇힌 것인지 보고, 갇혔을 때만 빼 준다.
// (벽을 향해 걷고 있을 뿐인데 옮겨 버리면 그게 더 이상하다)
function checkTrapped() {
  const p = state.player;
  if (state.mode === 'interior') {
    const it = state.interior;
    const tx = Math.floor(p.x / S), ty = Math.floor(p.y / S);
    // 실내는 좁으니 몇 칸만 움직일 수 있어도 갇힌 것으로 본다
    if (interiorOpenArea(it, tx, ty, 6) >= 6) return;
    unstick();
    return;
  }
  const tx = Math.floor(p.x / S), ty = Math.floor(p.y / S);
  if (map.openArea(tx, ty, PLAYER.safeArea) >= PLAYER.safeArea) return;
  unstick();
}

// 실내에서 걸어 다닐 수 있는 칸 수 (limit 까지만)
function interiorOpenArea(it, tx, ty, limit) {
  const seen = new Set([ty * 1000 + tx]);
  const queue = [{ x: tx, y: ty }];
  let count = 0;
  for (let i = 0; i < queue.length && count < limit; i++) {
    const q = queue[i];
    count++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = q.x + dx, ny = q.y + dy, key = ny * 1000 + nx;
      if (seen.has(key) || it.isSolid(nx, ny)) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return count;
}

// 갇혔을 때 빠져나갈 자리로 옮긴다.
// 실내면 문 앞으로, 바깥이면 가까운 넓은 자리로.
function unstick() {
  const p = state.player;
  stopAutoWalk();
  if (state.mode === 'interior') {
    const sp = state.interior.spawn;
    p.x = (sp.x + 0.5) * S; p.y = (sp.y + 0.5) * S;
    cam.snap(p.x, p.y);
    toast('길이 막혀 문 앞으로 돌아왔다.');
    return;
  }
  const spot = map.openSpot(Math.floor(p.x / S), Math.floor(p.y / S), PLAYER.safeArea);
  p.x = (spot.x + 0.5) * S; p.y = (spot.y + 0.5) * S;
  cam.snap(p.x, p.y);
  toast('좁은 데 끼어서 길가로 나왔다.');
}

// 바깥 좌표를 안전한 칸에 놓는다 (갇히는 자리로는 절대 내려놓지 않는다)
function placeOutdoors(tx, ty) {
  const spot = map.openSpot(tx, ty, PLAYER.safeArea);
  state.player.x = (spot.x + 0.5) * S;
  state.player.y = (spot.y + 0.5) * S;
  cam.snap(state.player.x, state.player.y);
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
  // 길에서 만난 사람
  const person = actors.nearestPerson(p.x, p.y, LIFE.talkRadius);
  if (person) return { type: 'talk', person, label: person.role || '주민' };

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
  // 옆에 닫힌 문이 있으면 열 수 있다
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    if (it.tileAt(tx + dx, ty + dy) === IN.DOOR) {
      const room = it.rooms.find((r) => r.door && r.door.x === tx + dx && r.door.y === ty + dy);
      return { type: 'door', x: tx + dx, y: ty + dy, label: room ? room.name : '문' };
    }
  }

  // 옆에 사람이 있으면 말을 걸 수 있다 (어두운 방 안 사람은 안 보인다)
  for (const person of state.indoorPeople) {
    if (!it.visibleAt(person.tx, person.ty)) continue;
    if (Math.hypot(person.x - p.x, person.y - p.y) < LIFE.talkRadius) {
      return { type: 'talk', person, label: person.role };
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
  const verb = t.type === 'talk' ? '말 걸기'
    : t.type === 'door' ? '문 열기'
    : t.type === 'enter' ? '들어가기'
    : t.type === 'exit' ? '나가기'
    : t.type === 'cat' ? '쓰다듬기'
    : t.type === 'stair' ? t.label
    : t.type === 'elevator' ? '층 고르기'
    : '만지기';
  state.prompt = `Space  ${verb} — ${t.label}`;
}

function interact() {
  // 자동 이동 중이면 먼저 선다 (걸어가면서 문을 여는 일은 없다)
  if (state.autoPath) { stopAutoWalk('자동 이동을 멈췄다.'); return; }

  const t = state.target;
  if (!t) return;
  switch (t.type) {
    case 'enter': return enterBuilding(t.building);
    case 'exit': return exitBuilding();
    case 'stair': return changeFloor(nextFloor(state.floor, t.delta));
    case 'elevator': return openPicker();
    case 'cat': return petCat(t.cat);
    case 'door': return openDoor(t);
    case 'talk': return talkTo(t.person);
    case 'gizmo': return useGizmo(t.gizmo);
  }
}

// 사람에게 말 걸기.
// 줄 것을 들고 있는 사람이면 마지막에 물어본다 — 손은 하나뿐이다.
function talkTo(person) {
  state.game.bump('talked');
  const item = person.gift && !person.gave ? ITEM_BY_ID.get(person.gift) : null;
  if (!item) {
    startDialogue(state, person.role || '주민', person.lines);
    return;
  }
  const held = state.game.item ? ITEM_BY_ID.get(state.game.item) : null;
  const lines = person.lines.concat([item.line]);
  const choices = held
    ? [
      { label: `${withJosa(held.name, '을/를')} 놓고 ${item.name} 받기`,
        run: () => { person.gave = true; swapItem(item, held); } },
      { label: `${withJosa(held.name, '을/를')} 계속 든다`,
        run: () => toast(`${withJosa(item.name, '은/는')} 그 자리에 두었다.`) },
    ]
    : [
      { label: `${item.name} 받기`, run: () => { person.gave = true; swapItem(item, null); } },
      { label: '괜찮다고 한다', run: () => toast('그냥 고맙다고만 했다.') },
    ];
  startDialogue(state, person.role || '주민', lines, { choices });
}

// 아이템 교체 — 하나만 들 수 있다
function swapItem(item, held) {
  state.game.takeItem(item.id, item.name);
  toast(held ? `${withJosa(held.name, '을/를')} 놓고 ${withJosa(item.name, '을/를')} 들었다.`
    : `${withJosa(item.name, '을/를')} 받았다.`);
}

// ── 아이템 쓰기 ─────────────────────────────────────────────────────────
// 사건 앞에서 쓰면 그날 하루가 그걸로 정해진다.
// 그냥 쓰면 물건마다 정해진 한 줄이 나온다.
function useItem() {
  if (state.dialogue || state.picker || state.game.ending) return;
  const id = state.game.item;
  if (!id) { toast('든 것이 없다. 사람에게 말을 걸어 보자.'); return; }
  const item = ITEM_BY_ID.get(id);

  // 가까이에 사건이 있으면 그쪽이 먼저다
  const enc = nearestEncounter();
  if (enc) { triggerEncounter(enc, id); return; }

  // 아니면 지금 있는 자리에 맞는 한 줄
  toast(`${item.name} — ${item.use}`);
  state.game.bump('used_item');
  state.game.set('use_' + id, `${item.name}을(를) 써 봤다`);
}

// 만질 수 있는 것 중 사건인 것 (실내·바깥 모두)
function nearestEncounter() {
  const p = state.player;
  const list = state.mode === 'outdoor' ? state.outdoorGizmos : state.interiorGizmos;
  let best = null, bestD = LIFE.encounterRadius;
  for (const g of list) {
    if (!g.encounter) continue;
    const d = Math.hypot((g.tx + 0.5) * S - p.x, (g.ty + 0.5) * S - p.y);
    if (d < bestD) { bestD = d; best = g; }
  }
  return best;
}

// 사건 하나를 마주한다. 들고 있는 것에 따라 결과가 갈린다.
function triggerEncounter(g, itemId) {
  const enc = g.encounter;
  const outcome = pickOutcome(enc, itemId || null);
  const used = outcome.item || null;
  startDialogue(state, enc.name, enc.intro, {
    onEnd: () => {
      const item = used ? ITEM_BY_ID.get(used) : null;
      state.game.set(encounterFlag(enc.id, used),
        item ? `${enc.name} 앞에서 ${withJosa(item.name, '을/를')} 썼다`
          : `${withJosa(enc.name, '을/를')} 맨손으로 마주했다`);
      state.game.bump('encounter');
      // 던지는 물건은 여기서 없어진다
      if (item && item.tag === '투척') state.game.dropItem();
      checkImmediateEnding();
    },
  });
}

// 문을 열면 그 방이 보인다
function openDoor(target) {
  const it = state.interior;
  it.setTile(target.x, target.y, IN.DOOR_OPEN);
  const idx = it.rooms.findIndex((r) => r.door && r.door.x === target.x && r.door.y === target.y);
  if (idx >= 0) {
    it.reveal(idx);
    toast(`${it.rooms[idx].name}`);
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
  if (g.encounter) return triggerEncounter(g, state.game.item);
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
  stopAutoWalk();
  state.interiorBuilding = b;
  const floors = floorList(b);
  setFloor(b, floors.includes(1) ? 1 : floors[0], 'spawn');
  state.mode = 'interior';
  cam.snap(state.player.x, state.player.y, { w: state.interior.w * S, h: state.interior.h * S });
  toast(`${b.name} · ${floorLabel(state.floor)}`);
  checkImmediateEnding();
}

function setFloor(b, floor, place) {
  state.floor = floor;
  if (floor < 0) state.game.bump('basement');   // 지하로 다닌 횟수
  state.interior = makeInterior(b, floor);
  // 오늘 이 층에 무슨 일이 있는가
  state.indoorEvent = pickIndoorEvent(b, floor);
  applyEventProps(state.interior, state.indoorEvent);
  state.indoorPeople = makeIndoorPeople(b, floor, state.interior, state.indoorEvent);
  if (state.indoorEvent && state.indoorEvent.notice) {
    toast(state.indoorEvent.notice);
    state.game.bump('seen_event');
  }
  // 다친 채로 병원 층에 들어가면 오늘은 거기서 끝난다
  if (state.game.has('hit') && String(floorUse(b, floor)).includes('병원')) {
    state.game.set('hospital', '다친 채로 병원에 갔다');
  }
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
  checkImmediateEnding();
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
  stopAutoWalk();
  const b = state.interiorBuilding;
  const out = doorOutside(b);
  state.mode = 'outdoor';
  state.interior = null;
  state.interiorGizmos = [];
  state.indoorPeople = [];
  state.indoorEvent = null;
  state.floor = 1;
  state.exitCooldown = INTERIOR.exitPause;
  placeOutdoors(out.x, out.y);
}

// 지하철로 다른 역까지
function rideTo(stationName) {
  stopAutoWalk();
  const target = buildings.list.find((b) => b.name === stationName);
  if (!target) return;
  const out = doorOutside(target);
  state.mode = 'outdoor';
  state.interior = null;
  state.interiorGizmos = [];
  state.interiorBuilding = null;
  state.floor = 1;
  state.exitCooldown = INTERIOR.exitPause;
  state.game.clock += 4 * 60; // 4분
  placeOutdoors(out.x, out.y);
  toast(`${stationName} 도착`);
}

// 차에 치이면 그 뒤로는 절뚝이며 걷는다. 하루가 끝나지는 않는다.
function checkCarHit() {
  if (state.game.has('hit')) return;
  const car = traffic.hitting(state.player);
  if (!car) return;
  state.game.set('hit', '차도에서 차에 치였다');
  state.game.clock += 6 * 60;             // 정신 차리는 데 걸린 시간
  stopAutoWalk();
  toast('차에 치였다. 다리를 절며 걷는다.');
  toast('두원타워 3층에 병원이 있다.');
}

// ── 결말 ────────────────────────────────────────────────────────────────
// 길에서 벌어지는 일이 눈에 들어오면 한 번 알려 준다
const seenOutdoorEvents = new Set();
function noticeOutdoorEvent() {
  const near = actors.nearestEvent(state.player.x, state.player.y, LIFE.noticeRadius);
  if (!near || seenOutdoorEvents.has(near.key)) return;
  seenOutdoorEvents.add(near.key);
  if (near.event.notice) {
    toast(near.event.notice);
    state.game.bump('seen_event');
  }
}

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
  stopAutoWalk();
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
  drawDialogue(ctx, state);
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
    useItem,
    // 사건 앞으로 (검증용)
    encounter(id) {
      const g = state.outdoorGizmos.find((x) => x.encounter && x.encounter.id === id);
      if (!g) return false;
      window.__gurae.tp(g.tx, g.ty + 1);
      return true;
    },
  };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
