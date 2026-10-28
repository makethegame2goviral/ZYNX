import { RARITIES } from './config.js';

export function mountEconomyUI(api, state) {
  const host = document.getElementById('app');
  const hud = document.getElementById('settings-button')?.parentElement;

  if (!host || !hud) return;

  const menu = document.createElement('button');
  menu.textContent = '▣ Basis';
  menu.className = 'icon-button';
  menu.style.cssText = 'width:auto;padding:8px 14px;background:linear-gradient(135deg,#16656e,#573992);color:white';
  hud.appendChild(menu);

  const panel = document.createElement('section');
  panel.id = 'base-economy-panel';
  panel.className = 'panel hidden';
  panel.style.cssText = 'background:linear-gradient(140deg,#101c33,#211632);border-color:#6f79bf';

  panel.innerHTML = `
    <div class="panel-header">
      <h2>Deine Basis</h2>
      <button data-dismiss>✕</button>
    </div>
    <p data-rate></p>
    <div data-slots style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px"></div>
    <p data-status role="status"></p>
    <small>Platzieren → Ei auswählen → Öffnen → Roboter verkaufen oder ins Inventar legen.</small>
  `;

  host.appendChild(panel);

  const query = selector => panel.querySelector(selector);
  let busy = false;
  let polling = false;
  let stopped = false;

  const money = value =>
    Number(value || 0).toLocaleString('de-DE', { maximumFractionDigits: 2 });

  function currentRoom() {
    const snapshot = state();

    if (snapshot.roomId) return snapshot.roomId;

    try {
      return snapshot.profile
        ? sessionStorage.getItem(`zynx-room-${snapshot.profile.id}`)
        : null;
    } catch {
      return null;
    }
  }

  const message = text => {
    query('[data-status]').textContent = text;
  };

  function eggLabel(egg) {
    const rarity = RARITIES.find(item => item.id === egg.rarity);
    return `${rarity?.label || egg.rarity}-Ei`;
  }

  function robotLabel(robot) {
    return `${robot.type?.name || 'Roboter'} · ${money(robot.type?.income_per_second)} Geld/s Basiswert`;
  }

  function render() {
    const snapshot = state();
    const profile = snapshot.profile;
    const config = snapshot.config;

    if (!profile || !config) return;

    const displayed = (snapshot.robots || []).filter(robot => robot.state === 'displayed');
    const income = displayed.reduce(
      (total, robot) => total + Number(robot.type?.income_per_second || 0),
      0
    ) * (1 + Number(profile.rebirth_count) * Number(config.rebirthIncomePerLevel));

    query('[data-rate]').textContent =
      `Einkommen: ${money(income)} Geld/s · ${displayed.length}/10 Roboter`;

    query('[data-slots]').replaceChildren();

    for (let slot = 0; slot < 10; slot++) {
      const egg = (snapshot.baseEggs || []).find(
        item => (item.baseSlot ?? item.base_slot) === slot
      );

      const robot = (snapshot.robots || []).find(
        item =>
          item.state === 'displayed' &&
          (item.baseSlot ?? item.base_slot) === slot
      );

      const button = document.createElement('button');
      button.style.cssText =
        'min-height:82px;padding:12px;border:1px solid #577b92;border-radius:12px;background:linear-gradient(135deg,#173648,#373054);color:white;display:flex;flex-direction:column;gap:8px';

      if (robot) {
        button.innerHTML = `<b>${robotLabel(robot)}</b>`;

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:8px';

        const sell = document.createElement('button');
        sell.textContent = 'Verkaufen';

        sell.onclick = async () => {
          if (busy) return;
          if (!confirm('Roboter verkaufen?')) return;

          busy = true;

          try {
            const result = await api.sellRobot(robot.id);
            message(`Verkauft für ${money(result.saleAmount)} Geld.`);
            await api.profile();
          } catch (error) {
            message(error.message);
          } finally {
            busy = false;
            render();
          }
        };

        const store = document.createElement('button');
        store.textContent = 'Ins Inventar';

        store.onclick = async () => {
          if (busy) return;

          busy = true;

          try {
            await api.storeRobot(robot.id);
            message('Roboter ins Inventar gelegt.');
            await api.profile();
          } catch (error) {
            message(error.message);
          } finally {
            busy = false;
            render();
          }
        };

        actions.append(sell, store);
        button.appendChild(actions);
      } else if (egg) {
        button.innerHTML = `<b>${eggLabel(egg)} platziert</b>`;

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:8px';

        const open = document.createElement('button');
        open.textContent = 'Öffnen';
        open.disabled = busy;

        open.onclick = async () => {
          if (busy) return;

          busy = true;

          try {
            const result = await api.openEgg(egg.id);
            const newRobot = (result.robots || []).find(
              item => item.id === result.resultRobotId
            );

            message(`${newRobot?.type?.name || 'Roboter'} erhalten.`);
            await api.profile();
          } catch (error) {
            message(error.message);
          } finally {
            busy = false;
            render();
          }
        };

        const take = document.createElement('button');
        take.textContent = 'Zurück ins Inventar';
        take.disabled = busy;

        take.onclick = async () => {
          if (busy) return;

          busy = true;

          try {
            await api.takeEgg(egg.id);
            message('Ei zurück ins Inventar gelegt.');
            await api.profile();
          } catch (error) {
            message(error.message);
          } finally {
            busy = false;
            render();
          }
        };

        actions.append(open, take);
        button.appendChild(actions);
      } else {
        button.innerHTML = `<b>Platz ${slot + 1}</b><span>Platzieren</span>`;

        button.onclick = async () => {
          if (busy) return;

          const eggs = (snapshot.inventoryEggs || []).filter(
            item => item.state === 'secured'
          );

          if (!eggs.length) {
            message('Kein gesichertes Ei im Inventar.');
            return;
          }

          const names = eggs.map(
            (item, index) => `${index + 1}: ${eggLabel(item)}`
          );

          const choice = prompt(
            `Welches Ei platzieren?\n${names.join('\n')}\n\nNummer eingeben:`
          );

          const index = Number(choice) - 1;

          if (!Number.isInteger(index) || index < 0 || index >= eggs.length) {
            return;
          }

          busy = true;

          try {
            await api.placeEgg(eggs[index].id, slot, currentRoom());
            message(`${eggLabel(eggs[index])} auf Platz ${slot + 1} platziert.`);
            await api.profile();
          } catch (error) {
            message(error.message);
          } finally {
            busy = false;
            render();
          }
        };
      }

      query('[data-slots]').appendChild(button);
    }

    const owned = (snapshot.robots || []).filter(robot => robot.state === 'owned');

    if (owned.length) {
      const title = document.createElement('p');
      title.textContent = `Im Inventar: ${owned.length} Roboter`;
      query('[data-slots]').appendChild(title);

      for (const robot of owned) {
        const button = document.createElement('button');
        button.textContent = `Aufstellen: ${robotLabel(robot)}`;
        button.disabled = busy;

        button.onclick = async () => {
          if (busy) return;

          const used = new Set([
            ...(snapshot.robots || [])
              .filter(item => item.state === 'displayed')
              .map(item => item.baseSlot ?? item.base_slot),
            ...(snapshot.baseEggs || []).map(item => item.baseSlot ?? item.base_slot)
          ]);

          let freeSlot = -1;

          for (let slot = 0; slot < 10; slot++) {
            if (!used.has(slot)) {
              freeSlot = slot;
              break;
            }
          }

          if (freeSlot < 0) {
            message('Alle Basisplätze sind belegt.');
            return;
          }

          busy = true;

          try {
            await api.placeRobot(robot.id, freeSlot, currentRoom());
            message(`Roboter auf Platz ${freeSlot + 1} aufgestellt.`);
            await api.profile();
          } catch (error) {
            message(error.message);
          } finally {
            busy = false;
            render();
          }
        };

        query('[data-slots]').appendChild(button);
      }
    }
  }

  menu.onclick = async () => {
    panel.classList.toggle('hidden');

    if (!panel.classList.contains('hidden')) {
      try {
        await api.profile();
      } catch (error) {
        message(error.message);
      }

      render();
    }
  };

  query('[data-dismiss]').onclick = () => panel.classList.add('hidden');

  const update = () => render();
  window.addEventListener('zynx-economy-updated', update);

  const timer = setInterval(async () => {
    if (stopped || polling || document.hidden || !state().profile) return;

    polling = true;

    try {
      await api.profile();
    } catch (error) {
      if (!panel.classList.contains('hidden')) {
        message(`Abrechnung: ${error.message}`);
      }
    } finally {
      polling = false;
    }
  }, 5000);

  window.addEventListener(
    'pagehide',
    () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener('zynx-economy-updated', update);
    },
    { once: true }
  );
}
