import { RARITIES } from './config.js';

export function mountEconomyUI(api, state) {
  const host = document.getElementById('app');
  const hud = document.getElementById('settings-button')?.parentElement;

  if (!host || !hud) return;

  const menu = document.createElement('button');
  menu.textContent = '▣ Basis';
  menu.className = 'icon-button';
  menu.style.cssText =
    'width:auto;padding:8px 14px;background:linear-gradient(135deg,#16656e,#573992);color:white';
  hud.appendChild(menu);

  const panel = document.createElement('section');
  panel.id = 'base-economy-panel';
  panel.className = 'panel hidden';
  panel.style.cssText =
    'background:linear-gradient(140deg,#101c33,#211632);border-color:#6f79bf';

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

  const money = value =>
    Number(value || 0).toLocaleString('de-DE', {
      maximumFractionDigits: 2
    });

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
    return `${robot.type?.name || 'Roboter'} · ${money(
      robot.type?.income_per_second
    )} Geld/s`;
  }

  function createCard(title) {
    const card = document.createElement('div');
    card.style.cssText =
      'min-height:100px;padding:12px;border:1px solid #577b92;border-radius:12px;background:linear-gradient(135deg,#173648,#373054);color:white;display:flex;flex-direction:column;gap:10px';

    const label = document.createElement('b');
    label.textContent = title;
    card.appendChild(label);

    return card;
  }

  function createActions() {
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
    return actions;
  }

  function createButton(text, onClick) {
    const button = document.createElement('button');
    button.textContent = text;
    button.disabled = busy;
    button.onclick = onClick;
    return button;
  }

  async function run(action, successText) {
    if (busy) return;

    busy = true;

    try {
      await action();
      if (successText) message(successText);
      await api.profile();
    } catch (error) {
      message(error.message);
    } finally {
      busy = false;
      render();
    }
  }

  function render() {
    const snapshot = state();
    const profile = snapshot.profile;
    const config = snapshot.config;

    if (!profile || !config) return;

    const displayed = (snapshot.robots || []).filter(
      robot => robot.state === 'displayed'
    );

    const income =
      displayed.reduce(
        (total, robot) =>
          total + Number(robot.type?.income_per_second || 0),
        0
      ) *
      (1 +
        Number(profile.rebirth_count) *
          Number(config.rebirthIncomePerLevel));

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

      let card;

      if (robot) {
        card = createCard(robotLabel(robot));

        const actions = createActions();

        actions.appendChild(
          createButton('Verkaufen', () => {
            if (!confirm('Roboter verkaufen?')) return;

            run(
              () => api.sellRobot(robot.id),
              'Roboter verkauft.'
            );
          })
        );

        actions.appendChild(
          createButton('Ins Inventar', () =>
            run(
              () => api.storeRobot(robot.id),
              'Roboter ins Inventar gelegt.'
            )
          )
        );

        card.appendChild(actions);
      } else if (egg) {
        card = createCard(`${eggLabel(egg)} platziert`);

        const actions = createActions();

        actions.appendChild(
          createButton('Öffnen', () =>
            run(
              () => api.openEgg(egg.id),
              'Ei geöffnet.'
            )
          )
        );

        actions.appendChild(
          createButton('Zurück ins Inventar', () =>
            run(
              () => api.takeEgg(egg.id),
              'Ei zurück ins Inventar gelegt.'
            )
          )
        );

        card.appendChild(actions);
      } else {
        card = createCard(`Platz ${slot + 1}`);

        const actions = createActions();

        actions.appendChild(
          createButton('Platzieren', () => {
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
              `Welches Ei platzieren?\n\n${names.join(
                '\n'
              )}\n\nNummer eingeben:`
            );

            const index = Number(choice) - 1;

            if (
              !Number.isInteger(index) ||
              index < 0 ||
              index >= eggs.length
            ) {
              return;
            }

            run(
              () =>
                api.placeEgg(
                  eggs[index].id,
                  slot,
                  currentRoom()
                ),
              `${eggLabel(eggs[index])} platziert.`
            );
          })
        );

        card.appendChild(actions);
      }

      query('[data-slots]').appendChild(card);
    }

    const owned = (snapshot.robots || []).filter(
      robot => robot.state === 'owned'
    );

    if (owned.length) {
      const title = document.createElement('p');
      title.textContent = `Im Inventar: ${owned.length} Roboter`;
      query('[data-slots]').appendChild(title);

      for (const robot of owned) {
        const card = createCard(robotLabel(robot));
        const actions = createActions();

        actions.appendChild(
          createButton('Aufstellen', () => {
            const used = new Set([
              ...(snapshot.robots || [])
                .filter(item => item.state === 'displayed')
                .map(item => item.baseSlot ?? item.base_slot),
              ...(snapshot.baseEggs || []).map(
                item => item.baseSlot ?? item.base_slot
              )
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

            run(
              () =>
                api.placeRobot(
                  robot.id,
                  freeSlot,
                  currentRoom()
                ),
              'Roboter aufgestellt.'
            );
          })
        );

        card.appendChild(actions);
        query('[data-slots]').appendChild(card);
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

  window.addEventListener('zynx-economy-updated', () => render());

  setInterval(async () => {
    if (document.hidden || !state().profile) return;

    try {
      await api.profile();
    } catch {
      // Stille Aktualisierung; Fehler erscheinen bei Benutzeraktionen.
    }
  }, 5000);

  render();
}
