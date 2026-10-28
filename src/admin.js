import { api } from './api.js';
import { showToast } from './ui.js';

let bound = false;
let currentRoom = null;

export function initAdmin(roomId) {
  currentRoom = roomId || currentRoom;

  const panel = document.getElementById('admin-panel');
  const button = document.getElementById('admin-button');
  if (!panel || !button) return;

  button.classList.remove('hidden');

  if (bound) return;
  bound = true;

  button.addEventListener('click', () => {
    panel.classList.toggle('hidden');
  });

  const value = id => document.getElementById(id).value;

  document.getElementById('give-money').addEventListener('click', async () => {
    try {
      await api.giveMoney(value('admin-user'), Number(value('admin-amount')));
      showToast('Geld gegeben.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  document.getElementById('spawn-egg').addEventListener('click', async () => {
    try {
      const rarity = value('admin-rarity');
      await api.spawnEgg(currentRoom, rarity, rarity);
      showToast(`${rarity}-Ei gespawnt.`, 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  document.getElementById('give-egg').addEventListener('click', async () => {
    try {
      await api.giveEgg(value('admin-user'), value('admin-rarity'), currentRoom);
      showToast('Ei gegeben.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  document.getElementById('send-message').addEventListener('click', async () => {
    try {
      await api.sendMessage(value('admin-message'), currentRoom);
      showToast('Nachricht gesendet.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  document.getElementById('start-event').addEventListener('click', async () => {
    try {
      await api.startEvent('double_money', currentRoom);
      showToast('Double Money gestartet.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  document.getElementById('ban-player').addEventListener('click', async () => {
    try {
      await api.banPlayer(currentRoom, value('admin-user'));
      showToast('Spieler gebannt.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  document.getElementById('move-player').addEventListener('click', async () => {
    try {
      await api.movePlayer(currentRoom, value('admin-user'));
      showToast('Spieler in Raum versetzt.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}
