import * as THREE from 'three';
import { GAME, RARITIES } from './config.js';
import { createWorld } from './world.js';
import { Player } from './player.js';
import { GuardianSystem } from './gameplay.js';
import { ServerEggSystem } from './server-eggs.js';
import { initSession } from './session.js';
import { initAuth, showAuth } from './auth.js';
import { initAdmin } from './admin.js';
import { api } from './api.js';
import { getSupabase } from './supabase.js';
import { sounds } from './audio.js';
import {
  setMoney,
  setSpeed,
  setZone,
  setPlayerName,
  setHint,
  renderInventory,
  showToast,
  currentZone
} from './ui.js';
import {
  setupDesktopControls,
  setupMouseCamera,
  setupTouchControls,
  setupPanels
} from './controls.js';

const element = id => document.getElementById(id);

function fatal(message) {
  let box = element('fatal-error');

  if (!box) {
    box = document.createElement('div');
    box.id = 'fatal-error';
    box.style.cssText =
      'position:fixed;bottom:12px;left:12px;right:12px;z-index:9999;padding:12px;background:#2a0b12;color:#ffd7dd;white-space:pre-wrap';
    document.body.appendChild(box);
  }

  box.textContent = `ZYNX-Fehler: ${message}`;
}

addEventListener('error', event => fatal(event.message));
addEventListener('unhandledrejection', event =>
  fatal(event.reason?.message || String(event.reason))
);

const canvas = element('game-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: 'default'
});
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400);
const cameraState = { yaw: 0, pitch: 0.35 };
const input = {
  moveInput: new THREE.Vector2(),
  jumpRequested: false,
  interactRequested: false
};

createWorld(scene);

const player = new Player(scene);
const guardians = new GuardianSystem(scene);
const eggs = new ServerEggSystem(scene);

for (const guardian of guardians.guardians.values()) {
  guardian.group.scale.setScalar(
    1 + Math.max(0, RARITIES.findIndex(zone => zone.id === guardian.id)) * GAME.guardian.scalePerTier
  );
}

const carryMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.35, 16, 12),
  new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    emissive: '#38bdf8',
    emissiveIntensity: 0.4
  })
);

carryMesh.position.set(0, 2.7, 0);
carryMesh.scale.y = 1.3;
carryMesh.visible = false;
player.group.add(carryMesh);

let inventory = [];
let carriedEgg = null;
let profile = null;
let roomId = null;
let userId = null;
let running = false;
let loadingProfile = false;
let adminReady = false;
let eggAction = false;
let nextEggAction = 0;
let lastNetworkError = 0;

setupDesktopControls(input);
setupMouseCamera(canvas, cameraState);

if (matchMedia('(pointer: coarse)').matches) {
  element('touch-controls').classList.remove('hidden');
  setupTouchControls(input, cameraState);
}

setupPanels();

function resize() {
  renderer.setPixelRatio(1);
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}

addEventListener('resize', resize);
resize();

function applyProfile(next) {
  if (!next) throw new Error('Profil fehlt');

  profile = next;

  const shop = THREE.MathUtils.clamp(
    Number(next.speed_shop_level) || 0,
    0,
    GAME.player.maxShopLevel
  );

  const training = THREE.MathUtils.clamp(
    Number(next.training_level) || 0,
    0,
    GAME.player.maxTrainingLevel
  );

  player.speed =
    GAME.player.baseSpeed + shop * GAME.player.speedPerShopLevel;
  player.trainingSpeedBonus =
    training * GAME.player.speedPerTrainingLevel;

  setPlayerName(next.username);
  setMoney(Number(next.money) || 0);
  setSpeed(player.currentSpeed);

  element('speed-level').textContent =
    `Level ${shop}/${GAME.player.maxShopLevel} · ${player.currentSpeed.toFixed(2)} m/s`;
  element('training-level').textContent =
    `Level ${training} · +${player.trainingSpeedBonus.toFixed(2)} m/s`;
  element('rebirth-count').textContent = String(next.rebirth_count);

  const cost = Math.round(
    GAME.shop.baseCost * Math.pow(GAME.shop.costMultiplier, shop)
  );

  element('buy-speed').textContent =
    shop >= GAME.player.maxShopLevel
      ? 'Maximales Shop-Level erreicht'
      : `Speed kaufen · ${cost.toLocaleString('de-DE')} · danach ${Math.min(
          GAME.player.maxShopSpeed,
          player.speed + GAME.player.speedPerShopLevel + player.trainingSpeedBonus
        ).toFixed(2)} m/s`;

  element('buy-speed').disabled =
    shop >= GAME.player.maxShopLevel || Number(next.money) < cost;
  element('rebirth-button').disabled =
    Number(next.money) < GAME.rebirth.moneyRequirement;

  if (!adminReady) {
    initAdmin(roomId);
    adminReady = true;
  }
}

function syncInventory(rows) {
  if (eggAction) return;

  inventory = rows.filter(
    egg =>
      egg.carrierId === userId &&
      ['carried', 'secured'].includes(egg.state)
  );

  const carried = inventory.find(egg => egg.state === 'carried') || null;

  if (carriedEgg && !carried) guardians.endChase();

  carriedEgg = carried;
  carryMesh.visible = Boolean(carried);

  if (carried) {
    const rarity = RARITIES.find(zone => zone.id === carried.rarity);

    carryMesh.material.color.set(rarity?.color || '#38bdf8');
    carryMesh.material.emissive.copy(carryMesh.material.color);

    if (!guardians.activeChase) {
      guardians.startChase(carried.zoneId, player);
    }
  }

  renderInventory(inventory);
}

function syncNow() {
  syncInventory([...eggs.items.values()]);
}

eggs.onSnapshot = syncInventory;

eggs.onError = error => {
  if (Date.now() - lastNetworkError > 10000) {
    showToast(`Eierverbindung: ${error.message}`, 'error');
    lastNetworkError = Date.now();
  }
};

async function eggTransaction(task) {
  if (eggAction || Date.now() < nextEggAction) return;

  eggAction = true;
  eggs.paused = true;
  eggs.version++;

  try {
    await task();
  } catch (error) {
    showToast(error.message, 'error');
    nextEggAction = Date.now() + 2000;
  } finally {
    eggAction = false;
    eggs.paused = false;
    syncNow();
    await eggs.refresh();
  }
}

function pickupEgg(egg) {
  if (
    carriedEgg ||
    inventory.length >= GAME.egg.inventorySlots ||
    !roomId ||
    !eggs.ready
  ) {
    return;
  }

  void eggTransaction(async () => {
    const { error } = await getSupabase().rpc('zynx_pickup_world_egg', {
      p_egg: egg.id
    });

    if (error) throw error;

    egg.state = 'carried';
    egg.carrierId = userId;
    egg.mesh.visible = false;
    carriedEgg = egg;

    guardians.startChase(egg.zoneId, player);
    sounds.pickup();
    sounds.alert();
    showToast('Ei aufgenommen. Zur Safe Zone fliehen!', 'success');
  });
}

function onGuardianCatch(zoneId) {
  if (!carriedEgg || carriedEgg.zoneId !== zoneId) return;

  const egg = carriedEgg;

  void eggTransaction(async () => {
    const { data, error } = await getSupabase().rpc('zynx_release_world_egg', {
      p_egg: egg.id
    });

    if (error) throw error;

    egg.state = 'free';
    egg.carrierId = null;
    egg.expiresAt = data.expires_at;
    carriedEgg = null;

    guardians.endChase();
    sounds.caught();
    showToast('Gefangen: Ei wurde wieder freigegeben.');
  });
}

function handleSafeZone() {
  if (!carriedEgg) return;

  const distance = Math.hypot(
    player.group.position.x,
    player.group.position.z
  );

  if (distance >= 13) return;

  const egg = carriedEgg;

  void eggTransaction(async () => {
    await api.secureEgg(egg.id);

    egg.state = 'secured';
    carriedEgg = null;

    guardians.endChase();
    sounds.safe();
    showToast('Ei serverseitig gesichert.', 'success');
  });
}

function startRender() {
  if (running) return;

  running = true;
  element('loading').classList.add('hidden');
  element('hud').classList.remove('hidden');

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    try {
      const delta = Math.min(clock.getDelta(), 0.05);

      input.updateFromKeyboard?.();
      player.update(delta, cameraState.yaw);
      guardians.update(delta, player, onGuardianCatch);
      eggs.update(delta, player, pickupEgg);
      handleSafeZone();

      const target = player.group.position
        .clone()
        .add(new THREE.Vector3(0, 1.5, 0));

      const offset = new THREE.Vector3(
        Math.sin(cameraState.yaw) * Math.cos(cameraState.pitch),
        Math.sin(cameraState.pitch),
        Math.cos(cameraState.yaw) * Math.cos(cameraState.pitch)
      ).multiplyScalar(GAME.camera.distance);

      camera.position.copy(target).add(offset);
      camera.lookAt(target);

      if (profile) setMoney(Number(profile.money));
      setSpeed(player.currentSpeed);

      const zone = currentZone(player.group.position);
      setZone(zone.label, zone.color);

      setHint(
        !roomId
          ? 'Über 🌐 einen Raum erstellen oder beitreten.'
          : !eggs.ready
            ? 'Eierverbindung wird hergestellt …'
            : eggAction
              ? 'Server prüft die Ei-Aktion …'
              : carriedEgg
                ? 'Fliehe zur Safe Zone!'
                : 'Sammle ein Ei in einer Seltenheitszone.'
      );

      renderer.render(scene, camera);
    } catch (error) {
      fatal(error.message);
    }
  }

  animate();
}

async function selectRoom(id) {
  if (carriedEgg || eggAction) {
    throw new Error('Bitte erst das getragene Ei sichern oder zurückgeben.');
  }

  roomId = id;
  guardians.endChase();
  inventory = [];
  renderInventory(inventory);

  await eggs.setRoom(id, userId);

  if (!eggs.ready) {
    throw new Error('Eier konnten für diesen Raum nicht geladen werden.');
  }

  try {
    sessionStorage.setItem(`zynx-room-${userId}`, id);
  } catch {}

  element('rooms-panel').classList.add('hidden');
  initAdmin(id);
}

async function loadGame() {
  if (loadingProfile) return;

  loadingProfile = true;

  try {
    const session = await initSession();

    if (!session.user) {
      showAuth();
      return;
    }

    userId = session.user.id;
    element('auth-overlay').classList.add('hidden');
    startRender();

    applyProfile((await api.profile()).profile);

    if (!roomId) {
      let saved = null;

      try {
        saved = sessionStorage.getItem(`zynx-room-${userId}`);
      } catch {}

      if (saved) {
        try {
          await selectRoom(saved);
        } catch (error) {
          showToast(error.message, 'error');
          element('rooms-panel').classList.remove('hidden');
        }
      } else {
        element('rooms-panel').classList.remove('hidden');
      }
    }
  } catch (error) {
    showToast(`Profil: ${error.message}`, 'error');
  } finally {
    loadingProfile = false;
  }
}

function setupRebirth() {
  const hud = element('settings-button').parentElement;

  const menu = document.createElement('button');
  menu.id = 'rebirth-menu-button';
  menu.textContent = '↻ Rebirth';
  menu.className = 'icon-button';
  menu.style.cssText =
    'width:auto;padding:8px 14px;background:linear-gradient(130deg,#5835a1,#265a8a);color:white;border:1px solid #aa89ff';

  hud.insertBefore(menu, element('settings-button'));

  const panel = document.createElement('section');
  panel.id = 'rebirth-panel';
  panel.className = 'panel hidden';
  panel.style.cssText =
    'background:linear-gradient(140deg,#17132e,#101d35);border-color:#8d73cf';

  panel.innerHTML = `
    <div class="panel-header">
      <h2>Wiedergeburt</h2>
      <button type="button" data-close-rebirth>✕</button>
    </div>
    <p data-economy-rebirth style="white-space:pre-line"></p>
  `;

  const row = element('rebirth-count').closest('.progress-row');

  if (row) panel.appendChild(row);
  panel.appendChild(element('rebirth-button'));
  element('app').appendChild(panel);

  element('shop-panel').querySelector('h2').textContent =
    'Speed Shop & Training';

  menu.onclick = () => {
    element('shop-panel').classList.add('hidden');
    panel.classList.toggle('hidden');
  };

  panel.querySelector('[data-close-rebirth]').onclick = () =>
    panel.classList.add('hidden');

  const caption = document.createElement('small');
  caption.textContent = ' m/s';
  element('speed-value').parentElement.appendChild(caption);
}

function setupProgression() {
  element('rooms-button').onclick = () =>
    element('rooms-panel').classList.toggle('hidden');

  element('shop-button').onclick = () =>
    element('shop-panel').classList.toggle('hidden');

  const bind = (id, task) => {
    element(id).addEventListener('click', async () => {
      const button = element(id);

      if (button.dataset.busy) return;

      button.dataset.busy = '1';
      button.disabled = true;

      try {
        await task();
      } catch (error) {
        showToast(error.message, 'error');
      } finally {
        delete button.dataset.busy;
        button.disabled = false;

        if (profile) applyProfile(profile);
      }
    });
  };

  bind('create-room', async () => {
    if (carriedEgg || eggAction) {
      throw new Error('Erst Ei sichern.');
    }

    const { room } = await api.createRoom(element('room-name').value);
    await selectRoom(room.id);
    showToast(`Raumcode: ${room.join_code}`, 'success');
  });

  bind('join-room', async () => {
    if (carriedEgg || eggAction) {
      throw new Error('Erst Ei sichern.');
    }

    const { room } = await api.joinRoom(element('join-code').value);
    await selectRoom(room.id);
    showToast('Raum beigetreten.', 'success');
  });

  bind('buy-speed', async () => {
    applyProfile((await api.buySpeed()).profile);
    showToast(`Speed: ${player.currentSpeed.toFixed(2)} m/s`, 'success');
  });

  bind('train-button', async () => {
    const result = await api.train(1);
    applyProfile(result.profile);

    if (result.levelUp) {
      showToast('Trainingslevel erhöht.', 'success');
    }
  });

  bind('rebirth-button', async () => {
    if (
      !confirm(
        'Wiedergeburt ausführen? Geld, Speed-Shop und Training werden zurückgesetzt. Roboter bleiben erhalten.'
      )
    ) {
      return;
    }

    applyProfile((await api.rebirth()).profile);
    showToast('Wiedergeburt abgeschlossen.', 'success');
  });

  element('logout-button').onclick = async () => {
    if (eggAction) {
      throw new Error('Bitte Ei-Aktion abwarten.');
    }

    if (carriedEgg) {
      const { error } = await getSupabase().rpc('zynx_release_world_egg', {
        p_egg: carriedEgg.id
      });

      if (error) {
        showToast(error.message, 'error');
        return;
      }
    }

    await getSupabase()?.auth.signOut();
    location.reload();
  };
}

setupRebirth();
setupProgression();
renderInventory(inventory);
initAuth(loadGame);
loadGame();
