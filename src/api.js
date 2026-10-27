import { getSupabase } from './supabase.js';

let functionUrl = window.ZYNX_API_URL || '';

export function setApiUrl(url) {
  functionUrl = url.replace(/\/$/, '');
}

async function call(action, payload = {}) {
  const supabase = getSupabase();
  if (!supabase || !functionUrl) throw new Error('API ist nicht konfiguriert.');
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Bitte melde dich an.');

  const response = await fetch(`${functionUrl}/zynx-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ action, ...payload })
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Serverfehler');
  return result;
}

export const api = {
  profile: () => call('profile.get'),
  createRoom: (name) => call('room.create', { name }),
  joinRoom: (code) => call('room.join', { code }),
  listRooms: () => call('room.list'),
  spawnEgg: (roomId, zoneId, rarity) => call('egg.spawn', { roomId, zoneId, rarity }),
  pickupEgg: (eggId) => call('egg.pickup', { eggId }),
  secureEgg: (eggId) => call('egg.secure', { eggId }),
  openEgg: (eggId) => call('egg.open', { eggId }),
  buySpeed: () => call('shop.speed'),
  train: (points = 1) => call('training.tick', { points }),
  rebirth: () => call('rebirth'),
  giveMoney: (userId, amount) => call('admin.money', { userId, amount }),
  giveRobot: (userId, typeId) => call('admin.robot', { userId, typeId }),
  giveEgg: (userId, rarity, roomId) => call('admin.egg', { userId, rarity, roomId }),
  sendMessage: (text, roomId, duration = 8) => call('admin.message', { text, roomId, duration }),
  startEvent: (eventType, roomId, duration = 600) => call('admin.event', { eventType, roomId, duration }),
  banPlayer: (roomId, userId, reason = '') => call('admin.ban', { roomId, userId, reason }),
  movePlayer: (roomId, userId) => call('admin.move', { roomId, userId })
};
