// Tabbed Stack Card für Home Assistant
// v1.0.0
(() => {
  const CARD_TAG = 'tabbed-stack-card';
  const EDITOR_TAG = 'tabbed-stack-card-editor';

  let helpersPromise = null;
  function getHelpers() {
    if (!helpersPromise) {
      helpersPromise = (window.loadCardHelpers
        ? window.loadCardHelpers()
        : Promise.reject(new Error('loadCardHelpers nicht verfügbar'))
      ).catch((err) => {
        // Bei Fehlschlag NICHT dauerhaft merken, sonst bleibt die Karte für
        // immer kaputt, falls loadCardHelpers beim ersten Versuch noch nicht bereitstand.
        helpersPromise = null;
        throw err;
      });
    }
    return helpersPromise;
  }

  function fireEvent(node, type, detail = {}, options = {}) {
    const event = new CustomEvent(type, {
      bubbles: options.bubbles ?? true,
      cancelable: Boolean(options.cancelable),
      composed: options.composed ?? true,
      detail,
    });
    node.dispatchEvent(event);
    return event;
  }

  function collectEntityIds(node, out) {
    if (Array.isArray(node)) {
      node.forEach((item) => collectEntityIds(item, out));
    } else if (node && typeof node === 'object') {
      Object.keys(node).forEach((key) => {
        const value = node[key];
        if (key === 'entity' && typeof value === 'string') {
          out.add(value);
        }
        collectEntityIds(value, out);
      });
    }
  }

  class TabbedStackCard extends HTMLElement {
    static getStubConfig() {
      return { tabs: [{ label: '', icon: '', cards: [] }] };
    }

    static getConfigElement() {
      return document.createElement(EDITOR_TAG);
    }

    _visibleIndices() {
      if (!this._config) return [];
      return this._config.tabs
        .map((t, i) => i)
        .filter((i) => this._config.tabs[i].enabled !== false);
    }

    setConfig(config) {
      if (!config || !Array.isArray(config.tabs) || config.tabs.length === 0) {
        throw new Error(
          'tabbed-stack-card: "tabs" muss ein Array mit mindestens einem Eintrag sein.'
        );
      }
      this._config = config;
      if (!this.shadowRoot) {
        this.attachShadow({ mode: 'open' });
      }
      const visible = this._visibleIndices();
      if (visible.length === 0) {
        this._activeIndex = 0;
      } else if (!visible.includes(this._activeIndex)) {
        this._activeIndex = visible[0];
      }
      this._tabEntities = config.tabs.map((tab) => {
        const found = new Set();
        collectEntityIds(tab.cards || [], found);
        return [...found].filter((eid) => {
          const domain = eid.split('.')[0];
          return [
            'light',
            'switch',
            'fan',
            'cover',
            'climate',
            'humidifier',
            'input_boolean'
          ].includes(domain);
        });
      });
      this._render();
    }

    set hass(hass) {
      this._hass = hass;
      // Absicherung: hass kann von Home Assistant theoretisch gesetzt werden,
      // bevor setConfig() vollständig durchgelaufen ist (z.B. beim Neuladen
      // des Dashboards). Ohne diese Prüfung würde der folgende Zugriff eine
      // nicht abgefangene Ausnahme werfen, die bei jeder Zustandsänderung für
      // jede Karte erneut ausgelöst wird.
      if (!this._config || !this._tabBodies) return;
      this._tabBodies.forEach(({ wrapper }) => {
        wrapper.querySelectorAll(':scope > .tsc-card').forEach((el) => {
          el.hass = hass;
        });
      });
      this._updateTabHighlights();
    }

    getCardSize() {
      return 5;
    }

    connectedCallback() {
      if (this._config) this._render();
    }

    _render() {
      const root = this.shadowRoot;
      root.innerHTML = '';
      this._tabBodies = new Map();

      const style = document.createElement('style');
      style.textContent = `
        :host { display: block; }
        ha-card { overflow: hidden; display: flex; flex-direction: column; }
        .tsc-tabbar-wrapper {
          display: flex;
          align-items: stretch;
          position: sticky;
          top: 0;
          z-index: 2;
          background: var(--ha-card-background, var(--card-background-color, #fff));
          border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.12));
        }
        .tsc-tabbar {
          display: flex;
          overflow-x: hidden;
          flex: 1 1 auto;
          min-width: 0;
          touch-action: pan-y;
        }
        .tsc-tabbar-nav {
          flex: 0 0 auto;
          display: none;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          align-self: center;
          margin: 0 2px;
          border: none;
          border-radius: 50%;
          background: transparent;
          color: var(--secondary-text-color);
          cursor: pointer;
          padding: 0;
          -webkit-tap-highlight-color: transparent;
          transition: background-color 150ms ease, color 150ms ease;
        }
        .tsc-tabbar-nav.visible { display: flex; }
        .tsc-tabbar-nav:hover {
          background: rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.08);
          color: var(--primary-color, #03a9f4);
        }
        .tsc-tabbar-nav:active {
          background: rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.14);
        }
        .tsc-tabbar-nav ha-icon {
          --mdc-icon-size: 20px;
          pointer-events: none;
        }
        .tsc-tab {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
          min-width: var(--tsc-tab-min-width, 72px);
          height: 42px;
          padding: 8px var(--tsc-tab-padding-h, 10px);
          border: none;
          box-sizing: border-box;
          background: transparent;
          border-radius: 14px 14px 0 0;
          color: var(--tsc-tab-base-text-color, var(--primary-text-color, #ffffff));
          font-size: var(--tsc-tab-font-size, 13px);
          font-weight: 600;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition:
            color 180ms ease,
            background-color 180ms ease;
        }
        .tsc-tab.tsc-tab-hidden {
          display: none;
        }
        .tsc-indicator {
          display: inline-block;
          margin-left: 6px;
          color: var(--tsc-tab-indicator-color, #00ffff);
          font-size: 7px;
          line-height: 1;
          visibility: hidden;
          opacity: 0;
          transition: opacity 150ms ease;
        }
        .tsc-indicator.active {
          visibility: visible;
          opacity: 1;
        }
        /* Wenn der Indikator global deaktiviert ist, wird sein reservierter
           Platz komplett freigegeben (nicht nur unsichtbar geschaltet) - das
           kommt der Tab-Breite zugute. */
        .tsc-tabbar.tsc-indicators-disabled .tsc-indicator {
          display: none;
        }
        /* Name/Icon werden nur dann in der Indikatorfarbe eingefärbt, wenn der
           Nutzer das explizit über "Name/Icon einfärben" aktiviert hat (Klasse
           tsc-tint-active auf der Tabbar). Standardmäßig bleibt die Schrift in
           der "Allgemeinen Textfarbe", nur der kleine Punkt reagiert. */
        .tsc-tabbar.tsc-tint-active .tsc-tab.has-active {
          color: var(--tsc-tab-indicator-color, #00ffff);
        }
        .tsc-tab.active {
          background: var(--tsc-tab-bg-color, rgba(var(--rgb-primary-color, 3, 169, 244), 0.18));
          color: var(--tsc-tab-text-color, var(--primary-text-color, #ffffff));
        }
        .tsc-tab.active.has-active {
          background: var(--tsc-tab-bg-color, rgba(var(--rgb-primary-color, 3, 169, 244), 0.18));
          color: var(--tsc-tab-text-color, var(--primary-text-color, #ffffff));
        }
        .tsc-tabbar.tsc-tint-active .tsc-tab.has-active ha-icon {
          color: var(--tsc-tab-indicator-color, #00ffff);
        }
        .tsc-tab.active ha-icon {
          color: var(--tsc-tab-text-color, var(--primary-text-color, #ffffff));
        }
        .tsc-content {
          overflow-y: auto;
          overflow-x: hidden;
          max-height: var(--tsc-max-height, 70vh);
          touch-action: pan-y;
        }
        .tsc-tabpanel { display: none; padding: 8px; box-sizing: border-box; }
        .tsc-tabpanel.active { display: block; }
        .tsc-card { display: block; margin-bottom: 8px; }
        .tsc-card:last-child { margin-bottom: 0; }
        .tsc-error { padding: 16px; color: var(--error-color, red); font-size: 13px; }
      `;
      root.appendChild(style);

      const card = document.createElement('ha-card');
      const visible = this._visibleIndices();
      this._visibleTabIndices = visible;

      if (this._tabbarResizeObserver) {
        this._tabbarResizeObserver.disconnect();
        this._tabbarResizeObserver = null;
      }
      this._tabbarEl = null;
      this._tabbarPages = null;

      if (visible.length > 1) {
        const tabbarWrapper = document.createElement('div');
        tabbarWrapper.className = 'tsc-tabbar-wrapper';

        const prevNav = document.createElement('button');
        prevNav.className = 'tsc-tabbar-nav tsc-tabbar-nav-prev';
        prevNav.setAttribute('aria-label', 'Frühere Tabs anzeigen');
        const prevNavIcon = document.createElement('ha-icon');
        prevNavIcon.setAttribute('icon', 'mdi:chevron-left');
        prevNav.appendChild(prevNavIcon);

        const tabbar = document.createElement('div');
        tabbar.className = 'tsc-tabbar';
        if (this._config.tab_font_size) {
          tabbar.style.setProperty('--tsc-tab-font-size', `${this._config.tab_font_size}px`);
        }
        if (this._config.tab_min_width) {
          tabbar.style.setProperty('--tsc-tab-min-width', `${this._config.tab_min_width}px`);
        }
        if (this._config.tab_padding_h) {
          tabbar.style.setProperty('--tsc-tab-padding-h', `${this._config.tab_padding_h}px`);
        }
        if (this._config.tab_bg_color) {
          tabbar.style.setProperty('--tsc-tab-bg-color', this._config.tab_bg_color);
        }
        if (this._config.tab_text_color) {
          tabbar.style.setProperty('--tsc-tab-text-color', this._config.tab_text_color);
        }
        if (this._config.tab_base_text_color) {
          tabbar.style.setProperty('--tsc-tab-base-text-color', this._config.tab_base_text_color);
        }
        if (this._config.tab_indicator_color) {
          tabbar.style.setProperty('--tsc-tab-indicator-color', this._config.tab_indicator_color);
        }
        if (this._config.tint_active_text) {
          tabbar.classList.add('tsc-tint-active');
        }
        if (this._config.show_indicators === false) {
          tabbar.classList.add('tsc-indicators-disabled');
        }

        visible.forEach((i) => {
          const tab = this._config.tabs[i];
          const btn = document.createElement('button');
          btn.className = 'tsc-tab' + (i === this._activeIndex ? ' active' : '');
          btn.dataset.tabIndex = String(i);
          const hasName = tab.label && tab.label.trim();
          if (tab.icon) {
            const icon = document.createElement('ha-icon');
            icon.setAttribute('icon', tab.icon);
            btn.appendChild(icon);
          }
          if (hasName || !tab.icon) {
            const span = document.createElement('span');
            span.textContent = hasName ? tab.label : `Tab ${i + 1}`;
            btn.appendChild(span);
          }
          const indicator = document.createElement('span');
          indicator.className = 'tsc-indicator';
          indicator.textContent = '●';
          btn.appendChild(indicator);
          btn.addEventListener('click', () => this._selectTab(i));
          tabbar.appendChild(btn);
        });

        const nextNav = document.createElement('button');
        nextNav.className = 'tsc-tabbar-nav tsc-tabbar-nav-next';
        nextNav.setAttribute('aria-label', 'Weitere Tabs anzeigen');
        const nextNavIcon = document.createElement('ha-icon');
        nextNavIcon.setAttribute('icon', 'mdi:chevron-right');
        nextNav.appendChild(nextNavIcon);

        this._tabbarEl = tabbar;
        this._tabbarPrevNavEl = prevNav;

        prevNav.addEventListener('click', () => this._stepTabbarPage(-1));
        nextNav.addEventListener('click', () => this._stepTabbarPage(1));
        this._attachSwipeHandlers(tabbar, (dir) => this._stepTabbarPage(dir));

        if (typeof ResizeObserver !== 'undefined') {
          this._tabbarResizeObserver = new ResizeObserver(() => this._recomputeTabbarPages());
          this._tabbarResizeObserver.observe(tabbar);
        }
        // Direkt nach dem Einhängen messen (Breite ist erst nach dem Layout bekannt).
        requestAnimationFrame(() => this._recomputeTabbarPages());
        // Zusätzliche Absicherung: falls Home Assistant das endgültige
        // Karten-/Spalten-Layout erst kurz nach dem ersten Zeichnen fertigstellt
        // (z.B. bei Masonry-Dashboards), hier noch einmal nachmessen.
        setTimeout(() => this._recomputeTabbarPages(), 300);

        tabbarWrapper.appendChild(prevNav);
        tabbarWrapper.appendChild(tabbar);
        tabbarWrapper.appendChild(nextNav);
        card.appendChild(tabbarWrapper);
      }

      const content = document.createElement('div');
      content.className = 'tsc-content';
      this._contentEl = content;
      this._attachSwipeHandlers(content, (dir) => this._stepTab(dir));
      card.appendChild(content);

      root.appendChild(card);

      this._buildTabPanel(this._activeIndex);
      this._showTabPanel(this._activeIndex);
      this._updateTabHighlights();
    }

    _isEntityActive(stateObj) {
      if (!stateObj) return false;

      switch (stateObj.entity_id.split('.')[0]) {
        case 'cover':
          return stateObj.state !== 'closed';

        case 'climate':
          return stateObj.state !== 'off';

        default:
          return stateObj.state === 'on';
      }
    }

    _updateTabHighlights() {
      if (!this.shadowRoot || !this._tabEntities || !this._hass) return;
      const buttons = this.shadowRoot.querySelectorAll('.tsc-tab');
      const indicatorsEnabled = this._config.show_indicators !== false;
      buttons.forEach((btn) => {
        const i = Number(btn.dataset.tabIndex);
        const indicator = btn.querySelector('.tsc-indicator');
        // anyOn wird IMMER ermittelt, unabhängig vom "Anzeigen"-Schalter: die
        // Einfärbung von Name/Icon (tint_active_text) ist eine eigenständige
        // Einstellung und darf nicht vom kleinen Punkt abhängen.
        const entities = this._tabEntities[i] || [];
        const anyOn = entities.some((eid) => this._isEntityActive(this._hass.states?.[eid]));
        btn.classList.toggle('has-active', anyOn);
        if (indicator) {
          indicator.classList.toggle('active', anyOn && indicatorsEnabled);
        }
      });
    }

    _selectTab(index) {
      if (index === this._activeIndex) return;
      this._activeIndex = index;
      // Falls der neu aktivierte Tab auf einer anderen Tabbar-Seite liegt
      // (z.B. durch _stepTab() beim Wischen im Inhalt), dorthin springen -
      // sonst bliebe der jetzt aktive Tab für den Nutzer unsichtbar.
      if (this._tabbarPages && this._tabbarPages.length > 0) {
        const containingPage = this._tabbarPages.findIndex((p) => p.includes(index));
        if (containingPage >= 0 && containingPage !== this._tabbarPageIndex) {
          this._tabbarPageIndex = containingPage;
          this._applyTabPage();
        }
      }
      this.shadowRoot.querySelectorAll('.tsc-tab').forEach((el) => {
        el.classList.toggle('active', Number(el.dataset.tabIndex) === index);
      });
      this._buildTabPanel(index);
      this._showTabPanel(index);
    }

    _showTabPanel(index) {
      this._contentEl.querySelectorAll('.tsc-tabpanel').forEach((el) => {
        el.classList.toggle('active', Number(el.dataset.index) === index);
      });
    }

    // --- Tabbar-Paginierung als Klassenmethoden (keine Scroll-Logik: die
    // Tab-Leiste scrollt nie, Seiten werden per Index gezeigt/versteckt) ---

    _buildTabbarPages(buttons, containerWidth, navWidth) {
      const total = buttons.length;
      if (total === 0 || containerWidth <= 0) {
        return [buttons.map((_, idx) => idx)];
      }

      const greedyFit = (start, availableWidth) => {
        const out = [];
        let sum = 0;
        for (let i = start; i < total; i++) {
          const w = buttons[i].offsetWidth;
          if (out.length > 0 && sum + w > availableWidth) break;
          out.push(i);
          sum += w;
        }
        // Mindestens ein Tab pro Seite, auch wenn er allein schon nicht passt -
        // verhindert eine Endlosschleife bei extrem schmaler Breite.
        if (out.length === 0) out.push(start);
        return out;
      };

      const pages = [];
      let idx = 0;
      while (idx < total) {
        // Links wird nur ab der zweiten Seite ein Pfeil gebraucht.
        const hasLeftChevron = pages.length > 0;
        const availableBase = containerWidth - (hasLeftChevron ? navWidth : 0);

        // Erster Versuch: annehmen, dass rechts KEIN Pfeil nötig ist (letzte Seite) -
        // maximiert die Tab-Anzahl auf der jeweils letzten Seite.
        let fit = greedyFit(idx, availableBase);
        const isActuallyLastPage = idx + fit.length >= total;
        if (!isActuallyLastPage) {
          // Es bleiben Tabs übrig -> rechter Pfeil wird gebraucht, mit dem
          // dadurch kleineren verfügbaren Platz neu rechnen.
          fit = greedyFit(idx, availableBase - navWidth);
        }

        pages.push(fit);
        idx += fit.length;
      }
      return pages;
    }

    _recomputeTabbarPages() {
      const tabbar = this._tabbarEl;
      if (!tabbar) return;
      // Tatsächliche Breite der Pfeil-Buttons aus dem CSS auslesen statt fest zu
      // verdrahten - bleibt so automatisch korrekt, auch wenn sich die CSS-Breite
      // von .tsc-tabbar-nav mal ändert. Funktioniert auch bei display:none, da
      // width als fester Pixelwert deklariert ist (kein Layout nötig).
      const navWidthRaw = this._tabbarPrevNavEl
        ? parseFloat(getComputedStyle(this._tabbarPrevNavEl).width)
        : NaN;
      const NAV_WIDTH = Number.isFinite(navWidthRaw) ? navWidthRaw : 32;
      const buttons = Array.from(tabbar.querySelectorAll('.tsc-tab'));
      // Kurz alle Tabs sichtbar machen, damit offsetWidth korrekt gemessen wird.
      // Der Indikator-Punkt selbst braucht hier keine Sonderbehandlung mehr: er
      // reserviert seinen Platz über CSS (visibility/opacity) immer konstant,
      // unabhängig vom Schalterzustand - diese Methode ist daher ausschließlich
      // für die Layoutberechnung zuständig und fasst den Indikator-Zustand nicht an.
      buttons.forEach((btn) => btn.classList.remove('tsc-tab-hidden'));
      const containerWidth = tabbar.clientWidth;
      this._tabbarPages = this._buildTabbarPages(buttons, containerWidth, NAV_WIDTH);
      // Nach jeder Neuberechnung (auch nach Resize) immer die Seite zeigen, auf
      // der der aktive Tab liegt, damit z.B. beim Wechsel von Desktop- zu
      // Handy-Breite nie eine inhaltlich andere Seite als "aktuelle Seite"
      // stehen bleibt.
      const containingPage = this._tabbarPages.findIndex((p) => p.includes(this._activeIndex));
      this._tabbarPageIndex = containingPage >= 0 ? containingPage : 0;
      this._applyTabPage();
    }

    _applyTabPage() {
      const tabbar = this._tabbarEl;
      if (!tabbar || !this.shadowRoot) return;
      const pages = this._tabbarPages || [];
      const buttons = Array.from(tabbar.querySelectorAll('.tsc-tab'));
      const pageIndices = new Set(pages[this._tabbarPageIndex] || buttons.map((_, idx) => idx));
      buttons.forEach((btn, idx) => {
        btn.classList.toggle('tsc-tab-hidden', !pageIndices.has(idx));
      });
      const prevNav = this.shadowRoot.querySelector('.tsc-tabbar-nav-prev');
      const nextNav = this.shadowRoot.querySelector('.tsc-tabbar-nav-next');
      if (prevNav) prevNav.classList.toggle('visible', this._tabbarPageIndex > 0);
      if (nextNav) nextNav.classList.toggle('visible', this._tabbarPageIndex < pages.length - 1);
    }

    _stepTabbarPage(delta) {
      const pages = this._tabbarPages || [];
      const next = this._tabbarPageIndex + delta;
      if (next < 0 || next > pages.length - 1) return;
      this._tabbarPageIndex = next;
      this._applyTabPage();
    }

    _attachSwipeHandlers(content, onSwipe) {
      let startX = 0;
      let startY = 0;
      let tracking = false;
      let isSwipe = false;
      const directionThreshold = 10; // px, ab wann wir "horizontal" erkennen
      const triggerThreshold = 50; // px, ab wann tatsächlich gewechselt wird

      const onStart = (e) => {
        const point = e.touches ? e.touches[0] : e;
        startX = point.clientX;
        startY = point.clientY;
        tracking = true;
        isSwipe = false;
      };

      const onMove = (e) => {
        if (!tracking) return;
        const point = e.touches ? e.touches[0] : e;
        const dx = point.clientX - startX;
        const dy = point.clientY - startY;
        if (!isSwipe && Math.abs(dx) > directionThreshold && Math.abs(dx) > Math.abs(dy)) {
          isSwipe = true;
        }
        if (isSwipe && e.cancelable) {
          // Eindeutig horizontal: Scrollen/Tap-Highlight der darunterliegenden Buttons unterdrücken
          e.preventDefault();
        }
      };

      const onEnd = (e) => {
        if (!tracking) return;
        tracking = false;
        if (isSwipe) {
          const point = e.changedTouches ? e.changedTouches[0] : e;
          const dx = point.clientX - startX;
          if (Math.abs(dx) >= triggerThreshold) {
            onSwipe(dx < 0 ? 1 : -1);
          }
          // Klick, der durch das Loslassen des Fingers entstehen könnte, abfangen
          this._suppressNextClick = true;
          setTimeout(() => {
            this._suppressNextClick = false;
          }, 300);
        }
        isSwipe = false;
      };

      content.addEventListener('touchstart', onStart, { passive: true });
      content.addEventListener('touchmove', onMove, { passive: false });
      content.addEventListener('touchend', onEnd, { passive: true });
      content.addEventListener('touchcancel', () => {
        tracking = false;
        isSwipe = false;
      });

      content.addEventListener(
        'click',
        (e) => {
          if (this._suppressNextClick) {
            e.stopPropagation();
            e.preventDefault();
          }
        },
        true
      );
    }

    _stepTab(delta) {
      const visible = this._visibleTabIndices && this._visibleTabIndices.length
        ? this._visibleTabIndices
        : this._visibleIndices();
      if (visible.length <= 1) return;
      const pos = visible.indexOf(this._activeIndex);
      const currentPos = pos === -1 ? 0 : pos;
      // Modulo-Rechnung sorgt für den Karussell-Effekt: nach dem letzten Tab
      // geht es wieder beim ersten weiter, und umgekehrt.
      const nextPos = (currentPos + delta + visible.length) % visible.length;
      this._selectTab(visible[nextPos]);
    }

    _buildTabPanel(index) {
      if (this._tabBodies.has(index)) return;
      const panel = document.createElement('div');
      panel.className = 'tsc-tabpanel';
      panel.dataset.index = String(index);
      this._contentEl.appendChild(panel);
      this._tabBodies.set(index, { wrapper: panel });

      const tabConfig = this._config.tabs[index];
      const cards = Array.isArray(tabConfig.cards) ? tabConfig.cards : [];

      getHelpers()
        .then((helpers) => {
          cards.forEach((cardConfig) => {
            let el;
            try {
              el = helpers.createCardElement(cardConfig);
              el.className = 'tsc-card';
              if (this._hass) el.hass = this._hass;
            } catch (err) {
              el = document.createElement('div');
              el.className = 'tsc-error';
              el.textContent = `Fehler in Karte: ${err.message}`;
            }
            panel.appendChild(el);
          });
        })
        .catch((err) => {
          const errEl = document.createElement('div');
          errEl.className = 'tsc-error';
          errEl.textContent = `Karten-Hilfsfunktionen nicht verfügbar: ${err.message}`;
          panel.appendChild(errEl);
        });
    }
  }

  class TabbedStackCardEditor extends HTMLElement {
    setConfig(config) {
      const incoming = JSON.stringify(config);
      if (incoming === this._lastEmitted) {
        // Das ist nur das Echo unserer eigenen letzten Änderung (Home Assistant
        // reicht den aktualisierten Stand zurück). Die Anzeige stimmt bereits,
        // ein Neuaufbau würde nur den Fokus aus dem gerade bearbeiteten Feld werfen.
        this._config = config;
        return;
      }
      this._config = JSON.parse(JSON.stringify(config));
      if (!Array.isArray(this._config.tabs) || this._config.tabs.length === 0) {
        this._config.tabs = [{ label: '', icon: '', cards: [] }];
      }
      if (!this._collapsedTabs) {
        // Beim allerersten Öffnen des Editors starten alle Tabs eingeklappt,
        // damit nur die allgemeinen Einstellungen sofort sichtbar sind.
        this._collapsedTabs = new Set(this._config.tabs.map((_, i) => i));
      }
      this._render();
    }

    set hass(hass) {
      this._hass = hass;
    }

    connectedCallback() {
      this._render();
    }

    _emitChange() {
      this._lastEmitted = JSON.stringify(this._config);
      fireEvent(this, 'config-changed', { config: this._config });
    }

    // Kleines Info-Icon mit Tooltip (Hover am Desktop, Antippen am Handy).
    // Bewusst selbst gebaut statt eine interne HA-Tooltip-Komponente zu nutzen,
    // deren genaues Verhalten/API nicht zuverlässig bekannt ist - so ist
    // garantiert, dass es auf jedem Gerät funktioniert.
    _createInfoTooltip(text, align = 'right') {
      const wrap = document.createElement('span');
      wrap.className = 'info-tooltip';
      if (align === 'left') wrap.classList.add('align-left');
      if (align === 'center') wrap.classList.add('align-center');

      const icon = document.createElement('ha-icon');
      icon.setAttribute('icon', 'mdi:information-outline');
      wrap.appendChild(icon);

      const bubble = document.createElement('span');
      bubble.className = 'info-bubble';
      bubble.textContent = text;
      wrap.appendChild(bubble);

      wrap.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        wrap.classList.toggle('tsc-tooltip-open');
      });

      return wrap;
    }

    _render() {
      if (!this._config) return;
      if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
      if (!this._collapsedTabs) this._collapsedTabs = new Set();
      const root = this.shadowRoot;
      root.innerHTML = '';

      const style = document.createElement('style');
      style.textContent = `
        .tab-block {
          border: 1px solid var(--divider-color, #ccc);
          border-radius: 8px;
          margin-bottom: 12px;
          overflow: hidden;
        }
        .tab-header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          background: var(--secondary-background-color, rgba(0,0,0,.04));
        }
        .header-field-wrap {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .header-field-wrap:first-of-type { flex: 2 1 120px; min-width: 100px; }
        .header-field-wrap:last-of-type { flex: 1 1 140px; min-width: 120px; max-width: 220px; }
        .header-field-caption {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: var(--secondary-text-color);
        }
        .header-name-input {
          width: 100%;
          box-sizing: border-box;
          font-size: 15px;
          font-weight: 600;
          border: none;
          border-bottom: 2px solid var(--divider-color, #ccc);
          background: transparent;
          color: var(--primary-text-color, #000);
          padding: 6px 4px;
          outline: none;
        }
        .header-name-input:focus {
          border-bottom-color: var(--primary-color, #03a9f4);
        }
        .header-name-input::placeholder {
          color: var(--secondary-text-color, #888);
          font-weight: 400;
        }
        .header-icon-input {
          width: 100%;
        }
        .tab-body { padding: 12px; }
        .row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
        .row ha-textfield { flex: 1; }
        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 8px 16px;
          margin: 12px 0;
          padding: 12px;
          background: var(--secondary-background-color, rgba(0,0,0,.03));
          border-radius: 8px;
        }
        .global-settings {
          border: 1px solid var(--divider-color, #ccc);
          border-radius: 10px;
          padding: 14px;
          margin-bottom: 16px;
          background: var(--card-background-color, #fff);
        }
        .editor-header {
          text-align: center;
          padding-bottom: 12px;
          margin-bottom: 14px;
          border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.1));
        }
        .editor-header-main {
          font-size: 20px;
          font-weight: 700;
          color: var(--primary-text-color);
        }
        .editor-header-sub {
          margin-top: 4px;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.03em;
          color: var(--secondary-text-color);
        }
        .global-settings .hint {
          font-size: 12px;
          color: var(--secondary-text-color);
          margin: 0 0 8px 0;
        }
        .settings-group-heading {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--primary-color, #03a9f4);
          margin: 18px 0 8px 0;
          padding-top: 12px;
          border-top: 1px solid var(--divider-color, rgba(0,0,0,.08));
        }
        .settings-group-heading ha-icon {
          --mdc-icon-size: 16px;
          color: var(--primary-color, #03a9f4);
        }
        .settings-group-heading:first-of-type {
          margin-top: 4px;
          padding-top: 0;
          border-top: none;
        }
        .setting-field { display: flex; flex-direction: column; gap: 4px; }
        .setting-field label { font-size: 12px; color: var(--secondary-text-color); }
        .setting-field label .info-tooltip { margin-left: 4px; }
        .info-tooltip {
          position: relative;
          display: inline-flex;
          align-items: center;
          vertical-align: middle;
          cursor: help;
        }
        .info-tooltip ha-icon {
          --mdc-icon-size: 15px;
          color: var(--secondary-text-color);
        }
        .info-tooltip .info-bubble {
          position: absolute;
          bottom: 130%;
          right: 0;
          left: auto;
          transform: translateY(4px);
          background: rgba(33, 33, 33, 0.95);
          color: #fff;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 400;
          line-height: 1.3;
          white-space: normal;
          width: max-content;
          max-width: 200px;
          box-shadow: 0 2px 6px rgba(0,0,0,.3);
          opacity: 0;
          pointer-events: none;
          transition: opacity 120ms ease, transform 120ms ease;
          z-index: 10;
        }
        .info-tooltip:hover .info-bubble,
        .info-tooltip.tsc-tooltip-open .info-bubble {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }
        .info-tooltip.align-left .info-bubble {
          right: auto;
          left: 0;
        }
        .info-tooltip.align-center .info-bubble {
          right: auto;
          left: 50%;
          transform: translateX(-50%) translateY(4px);
        }
        .info-tooltip.align-center:hover .info-bubble,
        .info-tooltip.align-center.tsc-tooltip-open .info-bubble {
          transform: translateX(-50%) translateY(0);
        }
        .setting-field input[type="color"] {
          width: 100%; height: 36px; border: none; border-radius: 6px; padding: 0; cursor: pointer;
        }
        .setting-field input[type="number"] {
          width: 100%; box-sizing: border-box; padding: 8px; border-radius: 6px;
          border: 1px solid var(--divider-color, #ccc); background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #000);
        }
        .reset-inline-icon {
          --mdc-icon-size: 15px;
          margin-left: 4px;
          color: var(--secondary-text-color);
          cursor: pointer;
          vertical-align: middle;
          transition: color 150ms ease;
        }
        .reset-inline-icon:hover {
          color: var(--primary-color, #03a9f4);
        }
        .color-row { display: flex; align-items: center; gap: 8px; }
        .color-row input[type="color"] { flex: 1; }
        .transparent-toggle {
          display: flex; align-items: center; gap: 4px; font-size: 12px;
          color: var(--secondary-text-color); white-space: nowrap;
        }
        .toggle-row { display: flex; align-items: center; gap: 8px; }
        .actions { display: flex; gap: 4px; margin-bottom: 8px; }
        .add-tab-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          margin-top: 8px;
          padding: 14px 20px;
          border: none;
          border-radius: 12px;
          background: var(--primary-color, #03a9f4);
          color: var(--text-primary-color, #fff);
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,.25);
          transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease;
        }
        .add-tab-button:hover {
          filter: brightness(1.08);
          box-shadow: 0 4px 10px rgba(0,0,0,.3);
        }
        .add-tab-button:active {
          transform: scale(0.98);
          box-shadow: 0 1px 3px rgba(0,0,0,.25);
        }
        label.section-label { font-size: 12px; color: var(--secondary-text-color); display:block; margin-bottom:4px; }
        ha-yaml-editor { display: block; margin-top: 4px; }
      `;
      root.appendChild(style);

      const wrap = document.createElement('div');
      wrap.style.padding = '8px';

      const globalBox = document.createElement('div');
      globalBox.className = 'global-settings';

      const globalTitleWrap = document.createElement('div');
      globalTitleWrap.className = 'editor-header';
      const globalTitleMain = document.createElement('div');
      globalTitleMain.className = 'editor-header-main';
      globalTitleMain.textContent = 'Tabbed Stack Card';
      const globalTitleSub = document.createElement('div');
      globalTitleSub.className = 'editor-header-sub';
      globalTitleSub.textContent = 'Einstellungsmenü';
      globalTitleWrap.appendChild(globalTitleMain);
      globalTitleWrap.appendChild(globalTitleSub);
      globalBox.appendChild(globalTitleWrap);



      const makeGroupHeading = (text, icon) => {
        const h = document.createElement('div');
        h.className = 'settings-group-heading';
        if (icon) {
          const headingIcon = document.createElement('ha-icon');
          headingIcon.setAttribute('icon', icon);
          h.appendChild(headingIcon);
        }
        const headingText = document.createElement('span');
        headingText.textContent = text;
        h.appendChild(headingText);
        return h;
      };

      // --- Gruppe 1: Erscheinungsbild ---
      globalBox.appendChild(makeGroupHeading('Erscheinungsbild', 'mdi:palette-outline'));
      const appearanceGrid = document.createElement('div');
      appearanceGrid.className = 'settings-grid';

      const globalFontField = document.createElement('div');
      globalFontField.className = 'setting-field';
      const globalFontLabel = document.createElement('label');
      globalFontLabel.textContent = 'Schriftgröße der Tab-Namen (px)';
      const globalFontInput = document.createElement('input');
      globalFontInput.type = 'number';
      globalFontInput.min = '10';
      globalFontInput.max = '28';
      globalFontInput.value = this._config.tab_font_size || 13;
      globalFontInput.addEventListener('input', (e) => {
        this._config.tab_font_size = Number(e.target.value) || 13;
        this._emitChange();
      });
      globalFontField.appendChild(globalFontLabel);
      globalFontField.appendChild(globalFontInput);

      const globalBaseTextColorField = document.createElement('div');
      globalBaseTextColorField.className = 'setting-field';
      const globalBaseTextColorLabel = document.createElement('label');
      globalBaseTextColorLabel.textContent = 'Allgemeine Textfarbe der Tabs';
      globalBaseTextColorLabel.appendChild(
        this._createInfoTooltip(
          'Schriftfarbe aller Tabs, die gerade nicht ausgewählt sind.',
          'center'
        )
      );
      const globalBaseTextColorInput = document.createElement('input');
      globalBaseTextColorInput.type = 'color';
      globalBaseTextColorInput.value = this._config.tab_base_text_color || '#ffffff';
      globalBaseTextColorInput.addEventListener('input', (e) => {
        this._config.tab_base_text_color = e.target.value;
        this._emitChange();
      });
      globalBaseTextColorField.appendChild(globalBaseTextColorLabel);
      globalBaseTextColorField.appendChild(globalBaseTextColorInput);

      const globalMinWidthField = document.createElement('div');
      globalMinWidthField.className = 'setting-field';
      const globalMinWidthLabel = document.createElement('label');
      globalMinWidthLabel.textContent = 'Mindestbreite pro Tab (px)';
      const globalMinWidthInput = document.createElement('input');
      globalMinWidthInput.type = 'number';
      globalMinWidthInput.min = '40';
      globalMinWidthInput.max = '140';
      globalMinWidthInput.value = this._config.tab_min_width || 72;
      globalMinWidthInput.addEventListener('input', (e) => {
        this._config.tab_min_width = Number(e.target.value) || 72;
        this._emitChange();
      });
      globalMinWidthField.appendChild(globalMinWidthLabel);
      globalMinWidthField.appendChild(globalMinWidthInput);

      const globalPaddingField = document.createElement('div');
      globalPaddingField.className = 'setting-field';
      const globalPaddingLabel = document.createElement('label');
      globalPaddingLabel.textContent = 'Innenabstand links/rechts (px)';
      globalPaddingLabel.appendChild(
        this._createInfoTooltip(
          'Freiraum zwischen dem Rand eines Tabs und seinem Namen/Icon. Kleinere Werte lassen mehr Tabs auf eine Seite passen.'
        )
      );
      const globalPaddingInput = document.createElement('input');
      globalPaddingInput.type = 'number';
      globalPaddingInput.min = '2';
      globalPaddingInput.max = '24';
      globalPaddingInput.value = this._config.tab_padding_h || 10;
      globalPaddingInput.addEventListener('input', (e) => {
        this._config.tab_padding_h = Number(e.target.value) || 10;
        this._emitChange();
      });
      globalPaddingField.appendChild(globalPaddingLabel);
      globalPaddingField.appendChild(globalPaddingInput);

      appearanceGrid.appendChild(globalBaseTextColorField);
      appearanceGrid.appendChild(globalFontField);
      appearanceGrid.appendChild(globalMinWidthField);
      appearanceGrid.appendChild(globalPaddingField);
      globalBox.appendChild(appearanceGrid);

      // --- Gruppe 2: Aktiver Tab ---
      const activeGroupHeading = makeGroupHeading('Aktiver Tab (gerade ausgewählt)', 'mdi:gesture-tap-button');
      activeGroupHeading.appendChild(
        this._createInfoTooltip(
          'Einstellungen für den Tab, der gerade angetippt/ausgewählt ist.',
          'center'
        )
      );
      globalBox.appendChild(activeGroupHeading);
      const activeGrid = document.createElement('div');
      activeGrid.className = 'settings-grid';

      const globalBgField = document.createElement('div');
      globalBgField.className = 'setting-field';
      const globalBgLabel = document.createElement('label');
      globalBgLabel.textContent = 'Hintergrundfarbe';
      globalBgLabel.appendChild(
        this._createInfoTooltip(
          'Hintergrundfarbe des gerade ausgewählten Tabs. "Transparent" verwendet keine eigene Farbe.',
          'left'
        )
      );
      const globalBgRow = document.createElement('div');
      globalBgRow.className = 'color-row';

      const isBgTransparent = this._config.tab_bg_color === 'transparent';
      const globalBgInput = document.createElement('input');
      globalBgInput.type = 'color';
      globalBgInput.value = (!isBgTransparent && this._config.tab_bg_color) || '#292929';
      globalBgInput.disabled = isBgTransparent;
      globalBgInput.addEventListener('input', (e) => {
        this._config.tab_bg_color = e.target.value;
        this._emitChange();
      });

      const transparentWrap = document.createElement('label');
      transparentWrap.className = 'transparent-toggle';
      const transparentCheckbox = document.createElement('input');
      transparentCheckbox.type = 'checkbox';
      transparentCheckbox.checked = isBgTransparent;
      transparentCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          this._config.tab_bg_color = 'transparent';
          globalBgInput.disabled = true;
        } else {
          globalBgInput.disabled = false;
          this._config.tab_bg_color = globalBgInput.value || '#292929';
        }
        this._emitChange();
      });
      transparentWrap.appendChild(transparentCheckbox);
      transparentWrap.appendChild(document.createTextNode('Transparent'));

      globalBgRow.appendChild(globalBgInput);
      globalBgRow.appendChild(transparentWrap);
      globalBgField.appendChild(globalBgLabel);
      globalBgField.appendChild(globalBgRow);

      const globalTextColorField = document.createElement('div');
      globalTextColorField.className = 'setting-field';
      const globalTextColorLabel = document.createElement('label');
      globalTextColorLabel.textContent = 'Schriftfarbe';
      globalTextColorLabel.appendChild(
        this._createInfoTooltip(
          'Schriftfarbe von Name und Icon des gerade ausgewählten Tabs.'
        )
      );
      const globalTextColorRow = document.createElement('div');
      globalTextColorRow.className = 'color-row';
      const globalTextColorInput = document.createElement('input');
      globalTextColorInput.type = 'color';
      globalTextColorInput.value = this._config.tab_text_color || '#ffffff';
      globalTextColorInput.addEventListener('input', (e) => {
        this._config.tab_text_color = e.target.value;
        this._emitChange();
      });

      const textColorResetIcon = document.createElement('ha-icon');
      textColorResetIcon.className = 'reset-inline-icon';
      textColorResetIcon.setAttribute('icon', 'mdi:restore');
      textColorResetIcon.setAttribute(
        'title',
        'Übernimmt die Farbe des Aktiv-Indikators als Schriftfarbe.'
      );
      textColorResetIcon.addEventListener('click', () => {
        const indicatorColor = this._config.tab_indicator_color || '#00ffff';
        this._config.tab_text_color = indicatorColor;
        globalTextColorInput.value = indicatorColor;
        this._emitChange();
      });
      globalTextColorLabel.appendChild(textColorResetIcon);

      globalTextColorRow.appendChild(globalTextColorInput);
      globalTextColorField.appendChild(globalTextColorLabel);
      globalTextColorField.appendChild(globalTextColorRow);

      activeGrid.appendChild(globalBgField);
      activeGrid.appendChild(globalTextColorField);
      globalBox.appendChild(activeGrid);

      // --- Gruppe 3: Aktiv-Indikator ---
      globalBox.appendChild(makeGroupHeading('Aktiv-Indikator', 'mdi:circle-medium'));
      const indicatorGrid = document.createElement('div');
      indicatorGrid.className = 'settings-grid';

      const globalIndicatorColorField = document.createElement('div');
      globalIndicatorColorField.className = 'setting-field';
      const globalIndicatorColorLabel = document.createElement('label');
      globalIndicatorColorLabel.textContent = 'Farbe';
      globalIndicatorColorLabel.appendChild(
        this._createInfoTooltip(
          'Farbe des kleinen Punktes, der an einem Tab erscheint, sobald dort ein Schalter/Licht aktiv ist.',
          'left'
        )
      );
      const globalIndicatorColorInput = document.createElement('input');
      globalIndicatorColorInput.type = 'color';
      globalIndicatorColorInput.value = this._config.tab_indicator_color || '#00ffff';
      globalIndicatorColorInput.addEventListener('input', (e) => {
        this._config.tab_indicator_color = e.target.value;
        this._emitChange();
      });
      globalIndicatorColorField.appendChild(globalIndicatorColorLabel);
      globalIndicatorColorField.appendChild(globalIndicatorColorInput);

      const globalTintField = document.createElement('div');
      globalTintField.className = 'setting-field';
      const globalTintLabel = document.createElement('label');
      globalTintLabel.textContent = 'Name/Icon in Indikatorfarbe einfärben';
      globalTintLabel.appendChild(
        this._createInfoTooltip(
          'Färbt zusätzlich zum Punkt auch den Namen und das Icon eines Tabs mit aktivem Schalter in der Indikatorfarbe ein.',
          'center'
        )
      );
      const globalTintToggleRow = document.createElement('div');
      globalTintToggleRow.className = 'toggle-row';
      const globalTintToggle = document.createElement('ha-switch');
      globalTintToggle.checked = this._config.tint_active_text === true;
      globalTintToggle.addEventListener('change', (e) => {
        this._config.tint_active_text = e.target.checked;
        this._emitChange();
      });
      globalTintToggleRow.appendChild(globalTintToggle);
      globalTintField.appendChild(globalTintLabel);
      globalTintField.appendChild(globalTintToggleRow);

      const globalIndicatorField = document.createElement('div');
      globalIndicatorField.className = 'setting-field';
      const globalIndicatorLabel = document.createElement('label');
      globalIndicatorLabel.textContent = 'Anzeigen';
      const globalToggleRow = document.createElement('div');
      globalToggleRow.className = 'toggle-row';
      const globalIndicatorToggle = document.createElement('ha-switch');
      globalIndicatorToggle.checked = this._config.show_indicators !== false;
      globalIndicatorToggle.addEventListener('change', (e) => {
        this._config.show_indicators = e.target.checked;
        this._emitChange();
      });
      globalToggleRow.appendChild(globalIndicatorToggle);
      globalIndicatorField.appendChild(globalIndicatorLabel);
      globalIndicatorField.appendChild(globalToggleRow);

      indicatorGrid.appendChild(globalIndicatorColorField);
      indicatorGrid.appendChild(globalTintField);
      indicatorGrid.appendChild(globalIndicatorField);
      globalBox.appendChild(indicatorGrid);

      wrap.appendChild(globalBox);

      this._config.tabs.forEach((tab, index) => {
        const block = document.createElement('div');
        block.className = 'tab-block';

        const isCollapsed = this._collapsedTabs.has(index);

        const header = document.createElement('div');
        header.className = 'tab-header';

        const toggleBtn = document.createElement('ha-icon-button');
        toggleBtn.setAttribute('label', 'Ein-/Ausklappen');
        const toggleIcon = document.createElement('ha-icon');
        toggleIcon.setAttribute('icon', isCollapsed ? 'mdi:chevron-down' : 'mdi:chevron-up');
        toggleBtn.appendChild(toggleIcon);
        toggleBtn.addEventListener('click', () => {
          if (this._collapsedTabs.has(index)) {
            this._collapsedTabs.delete(index);
          } else {
            this._collapsedTabs.add(index);
          }
          this._render();
        });
        header.appendChild(toggleBtn);

        const nameFieldWrap = document.createElement('div');
        nameFieldWrap.className = 'header-field-wrap';
        const nameFieldCaption = document.createElement('span');
        nameFieldCaption.className = 'header-field-caption';
        nameFieldCaption.textContent = 'Name:';
        const labelField = document.createElement('input');
        labelField.type = 'text';
        labelField.placeholder = `Tab ${index + 1}`;
        labelField.value = tab.label || '';
        labelField.className = 'header-name-input';
        labelField.addEventListener('input', (e) => {
          this._config.tabs[index].label = e.target.value;
          this._emitChange();
        });
        nameFieldWrap.appendChild(nameFieldCaption);
        nameFieldWrap.appendChild(labelField);
        header.appendChild(nameFieldWrap);

        const iconFieldWrap = document.createElement('div');
        iconFieldWrap.className = 'header-field-wrap';
        const iconFieldCaption = document.createElement('span');
        iconFieldCaption.className = 'header-field-caption';
        iconFieldCaption.textContent = 'Symbol:';
        const iconField = document.createElement('ha-icon-picker');
        iconField.className = 'header-icon-input';
        iconField.value = tab.icon || '';
        iconField.addEventListener('value-changed', (e) => {
          this._config.tabs[index].icon = e.detail.value || '';
          this._emitChange();
        });
        iconFieldWrap.appendChild(iconFieldCaption);
        iconFieldWrap.appendChild(iconField);
        header.appendChild(iconFieldWrap);

        block.appendChild(header);

        if (!isCollapsed) {
          const body = document.createElement('div');
          body.className = 'tab-body';

          const actions = document.createElement('div');
          actions.className = 'actions';

          const upBtn = document.createElement('ha-icon-button');
          upBtn.setAttribute('label', 'Nach oben');
          const upIcon = document.createElement('ha-icon');
          upIcon.setAttribute('icon', 'mdi:arrow-up');
          upBtn.appendChild(upIcon);
          upBtn.disabled = index === 0;
          upBtn.addEventListener('click', () => this._moveTab(index, -1));

          const downBtn = document.createElement('ha-icon-button');
          downBtn.setAttribute('label', 'Nach unten');
          const downIcon = document.createElement('ha-icon');
          downIcon.setAttribute('icon', 'mdi:arrow-down');
          downBtn.appendChild(downIcon);
          downBtn.disabled = index === this._config.tabs.length - 1;
          downBtn.addEventListener('click', () => this._moveTab(index, 1));

          const delBtn = document.createElement('ha-icon-button');
          delBtn.setAttribute('label', 'Tab entfernen');
          const delIcon = document.createElement('ha-icon');
          delIcon.setAttribute('icon', 'mdi:delete');
          delBtn.appendChild(delIcon);
          delBtn.addEventListener('click', () => this._removeTab(index));

          actions.appendChild(upBtn);
          actions.appendChild(downBtn);
          actions.appendChild(delBtn);
          body.appendChild(actions);

          const settingsGrid = document.createElement('div');
          settingsGrid.className = 'settings-grid';

          const enabledField = document.createElement('div');
          enabledField.className = 'setting-field';
          const enabledLabel = document.createElement('label');
          enabledLabel.textContent = 'Tab aktiviert (in der Leiste sichtbar)';
          const enabledToggleRow = document.createElement('div');
          enabledToggleRow.className = 'toggle-row';
          const enabledToggle = document.createElement('ha-switch');
          enabledToggle.checked = tab.enabled !== false;
          enabledToggle.addEventListener('change', (e) => {
            this._config.tabs[index].enabled = e.target.checked;
            this._emitChange();
          });
          enabledToggleRow.appendChild(enabledToggle);
          enabledField.appendChild(enabledLabel);
          enabledField.appendChild(enabledToggleRow);

          settingsGrid.appendChild(enabledField);
          body.appendChild(settingsGrid);

          const cardsLabel = document.createElement('label');
          cardsLabel.className = 'section-label';
          cardsLabel.textContent = 'Karten dieses Tabs (YAML-Liste)';
          body.appendChild(cardsLabel);

          const yamlEditor = document.createElement('ha-yaml-editor');
          yamlEditor.defaultValue = tab.cards || [];
          yamlEditor.addEventListener('value-changed', (e) => {
            if (e.detail && e.detail.isValid !== false) {
              this._config.tabs[index].cards = e.detail.value || [];
              this._emitChange();
            }
          });
          body.appendChild(yamlEditor);

          block.appendChild(body);
        }

        wrap.appendChild(block);
      });

      const addBtn = document.createElement('button');
      addBtn.className = 'add-tab-button';
      const addBtnIcon = document.createElement('ha-icon');
      addBtnIcon.setAttribute('icon', 'mdi:plus-circle');
      const addBtnLabel = document.createElement('span');
      addBtnLabel.textContent = 'Neuen Tab hinzufügen';
      addBtn.appendChild(addBtnIcon);
      addBtn.appendChild(addBtnLabel);
      addBtn.addEventListener('click', () => {
        this._config.tabs.push({ label: '', icon: '', cards: [] });
        this._render();
        this._emitChange();
      });
      wrap.appendChild(addBtn);

      root.appendChild(wrap);
    }

    _moveTab(index, delta) {
      const newIndex = index + delta;
      if (newIndex < 0 || newIndex >= this._config.tabs.length) return;
      const tabs = this._config.tabs;
      [tabs[index], tabs[newIndex]] = [tabs[newIndex], tabs[index]];
      this._emitChange();
      this._render();
    }

    _removeTab(index) {
      if (this._config.tabs.length <= 1) return;
      this._config.tabs.splice(index, 1);
      this._emitChange();
      this._render();
    }
  }

  if (!customElements.get(CARD_TAG)) {
    customElements.define(CARD_TAG, TabbedStackCard);
  }
  if (!customElements.get(EDITOR_TAG)) {
    customElements.define(EDITOR_TAG, TabbedStackCardEditor);
  }

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: CARD_TAG,
    name: 'Tabbed Stack Card',
    description:
      'Scrollbare Karte mit festen, konfigurierbaren Tabs im Kopfbereich – für frei platzierbare Unterkarten pro Tab.',
  });
})();
