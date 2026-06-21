/* =============================================================================
 * Lumo Tickets — Seat Picker v1.1
 *
 * Mudanças v1.1:
 *   - Cadeiras de acessibilidade (PCR/PMR/AC/PO) fazem fallback pra variação base
 *     da área quando não há variação específica do kind.
 *   - Vendidas/reservadas ficam visíveis (não-clicáveis) com cor própria.
 *   - Mobile: 1 dedo move o mapa, 2 dedos fazem zoom.
 *   - Subtitle do sheet sem "Sem limite por compra".
 *   - Estrutura SVG por poltrona: <g class="seat-group ...">shape+text</g>
 * ============================================================================= */
(function () {
  'use strict';

  if (typeof window === 'undefined') return;

  function boot() {
    var containers = document.querySelectorAll('.lumo-seat-picker[data-product-id]');
    containers.forEach(function (el) {
      if (el.dataset.lumoInitialized === '1') return;
      el.dataset.lumoInitialized = '1';
      new LumoSeatPicker(el);
    });
  }

  function LumoSeatPicker(rootEl) {
    var self = this;
    self.root = rootEl;
    self.config = {
      productId: parseInt(rootEl.dataset.productId, 10),
      restBase:  rootEl.dataset.restBase  || '/wp-json/customtickets/v1',
      cartUrl:   rootEl.dataset.cartUrl   || '/cart/',
      currencySymbol: rootEl.dataset.currencySymbol || 'R$',
      triggerLabel:   rootEl.dataset.triggerLabel  || 'Escolher poltronas',
    };

    self.state = {
      venue: null,
      seatMap: null,
      variationIndex: {},
      seatStatus: {},
      layout: null,
      selection: new Map(),
      panZoom: null,
      reservationToken: null,
      modalByArea: null,
      modalQty: new Map(),
    };

    self.dom = {};
    self._setupUI();
    self._loadData();
  }

  LumoSeatPicker.prototype._setupUI = function () {
    var self = this;
    var root = self.root;

    var trigger = root.querySelector('.lumo-seat-picker-trigger');
    if (!trigger) {
      trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'lumo-seat-picker-trigger lumo-seat-picker-trigger--loading';
      trigger.disabled = true;
      trigger.innerHTML = '<span>Carregando mapa…</span>';
      root.appendChild(trigger);
    }
    self.dom.trigger = trigger;

    var summary = root.querySelector('.lumo-seat-picker-summary');
    if (!summary) {
      summary = document.createElement('p');
      summary.className = 'lumo-seat-picker-summary';
      summary.textContent = 'Carregando mapa do teatro…';
      root.appendChild(summary);
    }
    self.dom.summary = summary;

    trigger.addEventListener('click', function () { self._openModal(); });
  };

  LumoSeatPicker.prototype._buildModal = function () {
    var self = this;
    if (self.dom.modal) return;

    var modal = document.createElement('div');
    modal.className = 'lumo-seat-picker-modal';
    modal.innerHTML = ''
      + '<header>'
      +   '<h2 class="lumo-seat-picker-modal__title">' + escapeHtml(self.state.venue.venue.name) + '</h2>'
      +   '<button type="button" class="lumo-seat-picker-modal__close" aria-label="Fechar">×</button>'
      + '</header>'
      + '<div class="lumo-seat-picker__legend"></div>'
      + '<div class="lumo-seat-picker__map-container">'
      +   '<svg class="lumo-seat-picker__map" xmlns="http://www.w3.org/2000/svg"></svg>'
      +   '<div class="lumo-seat-picker__zoom-controls">'
      +     '<button type="button" class="lumo-seat-picker__zoom-btn" data-zoom="in" aria-label="Aproximar">+</button>'
      +     '<button type="button" class="lumo-seat-picker__zoom-btn" data-zoom="out" aria-label="Afastar">−</button>'
      +     '<button type="button" class="lumo-seat-picker__zoom-btn" data-zoom="fit" aria-label="Ajustar" style="font-size:14px;">⤢</button>'
      +   '</div>'
      + '</div>'
      + '<footer class="lumo-seat-picker__bottom-bar">'
      +   '<div class="lumo-seat-picker__selection-info">'
      +     '<p class="lumo-seat-picker__selection-count">Toque nas poltronas pra selecionar</p>'
      +     '<p class="lumo-seat-picker__selection-total">' + self.config.currencySymbol + ' 0,00</p>'
      +   '</div>'
      +   '<button type="button" class="lumo-seat-picker__cta" disabled>Continuar</button>'
      + '</footer>';
    document.body.appendChild(modal);
    self.dom.modal = modal;
    self.dom.legend = modal.querySelector('.lumo-seat-picker__legend');
    self.dom.svg = modal.querySelector('.lumo-seat-picker__map');
    self.dom.selectionCount = modal.querySelector('.lumo-seat-picker__selection-count');
    self.dom.selectionTotal = modal.querySelector('.lumo-seat-picker__selection-total');
    self.dom.continueBtn = modal.querySelector('.lumo-seat-picker__cta');

    var sheet = document.createElement('div');
    sheet.className = 'lumo-seat-picker__sheet-backdrop';
    sheet.innerHTML = ''
      + '<div class="lumo-seat-picker__sheet">'
      +   '<h3 class="lumo-seat-picker__sheet-title">Quantas meias-entradas?</h3>'
      +   '<p class="lumo-seat-picker__sheet-subtitle">Defina por setor. As demais ficam como inteira.</p>'
      +   '<div class="lumo-seat-picker__qty-rows"></div>'
      +   '<div class="lumo-seat-picker__sheet-summary"><span>Total</span><strong>' + self.config.currencySymbol + ' 0,00</strong></div>'
      +   '<div class="lumo-seat-picker__sheet-actions">'
      +     '<button type="button" class="lumo-seat-picker__sheet-back">Voltar</button>'
      +     '<button type="button" class="lumo-seat-picker__sheet-confirm">Confirmar e ir pro carrinho</button>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(sheet);
    self.dom.sheet = sheet;

    var toast = document.createElement('div');
    toast.className = 'lumo-seat-picker__toast';
    document.body.appendChild(toast);
    self.dom.toast = toast;

    var sub = document.createElement('div');
    sub.className = 'lumo-seat-picker__submitting';
    sub.innerHTML = '<div class="lumo-seat-picker__spinner"></div><div>Reservando suas poltronas…</div>';
    document.body.appendChild(sub);
    self.dom.submitting = sub;
    self.dom.submittingMsg = sub.querySelector('div:last-child');

    modal.querySelector('.lumo-seat-picker-modal__close').addEventListener('click', function () { self._closeModal(); });
    modal.querySelectorAll('[data-zoom]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!self.state.panZoom) return;
        var dir = btn.dataset.zoom;
        if (dir === 'in')  self.state.panZoom.zoomIn();
        if (dir === 'out') self.state.panZoom.zoomOut();
        if (dir === 'fit') { self.state.panZoom.resize(); self.state.panZoom.fit(); self.state.panZoom.center(); }
      });
    });
    self.dom.continueBtn.addEventListener('click', function () { self._openSheet(); });
    sheet.querySelector('.lumo-seat-picker__sheet-back').addEventListener('click', function () { sheet.classList.remove('is-open'); });
    sheet.querySelector('.lumo-seat-picker__sheet-confirm').addEventListener('click', function () { self._submit(); });
  };

  LumoSeatPicker.prototype._loadData = function () {
    var self = this;

    // Tenta carregar venue do DOM como prefetch (opcional — a API também retorna)
    var venueScript = document.getElementById('lumo-venue-data');
    if (venueScript) {
      try { self.state.venue = JSON.parse(venueScript.textContent); } catch (e) {}
    }

    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var fetchTimer = ctrl ? setTimeout(function () { ctrl.abort(); }, 8000) : null;

    fetch(self.config.restBase + '/seat-map?product_id=' + self.config.productId, {
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' },
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then(function (r) {
        if (fetchTimer) clearTimeout(fetchTimer);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (json) {
        if (json.status !== 'success') throw new Error('API status');
        self.state.seatMap = json.data;

        // Venue: prefer embedded in API response, fallback to DOM script tag
        if (json.data.venue) {
          self.state.venue = json.data.venue;
        } else if (!self.state.venue) {
          var venueScript = document.getElementById('lumo-venue-data');
          if (!venueScript) {
            self.dom.summary.textContent = 'Mapa não disponível pra este evento.';
            return;
          }
          self.state.venue = JSON.parse(venueScript.textContent);
        }

        self._indexBackendData();
        self.state.layout = computeLayout(self.state.venue);
        var sold = Object.keys(self.state.seatStatus).filter(function (k) { return self.state.seatStatus[k] === 'sold'; }).length;
        self.dom.summary.textContent = self.state.venue.venue.salable_seats + ' poltronas disponíveis'
          + (sold > 0 ? ' · ' + sold + ' vendidas' : '');
        self.dom.trigger.classList.remove('lumo-seat-picker-trigger--loading');
        self.dom.trigger.innerHTML = '<span>' + self.config.triggerLabel + '</span><span class="lumo-seat-picker-trigger-arrow">›</span>';
        self.dom.trigger.disabled = false;
      })
      .catch(function (e) {
        self.dom.trigger.classList.remove('lumo-seat-picker-trigger--loading');
        self.dom.trigger.innerHTML = '<span>Tente novamente</span>';
        self.dom.trigger.disabled = false;
        self.dom.trigger.addEventListener('click', function retry() {
          self.dom.trigger.removeEventListener('click', retry);
          self.dom.trigger.disabled = true;
          self.dom.trigger.innerHTML = '<span>Carregando mapa…</span>';
          self.dom.trigger.classList.add('lumo-seat-picker-trigger--loading');
          self._loadData();
        }, { once: true });
        self.dom.summary.textContent = 'Erro ao carregar mapa. Clique pra tentar de novo.';
      });
  };

  LumoSeatPicker.prototype._indexBackendData = function () {
    var self = this;
    self.state.variationIndex = {};
    (self.state.seatMap.seats || []).forEach(function (s) {
      var gid = String(s.group_id || '').toLowerCase();
      if (gid && s.variation_full_id) {
        self.state.variationIndex[gid + '|inteira'] = { variation_id: s.variation_full_id, price: Number(s.price_full || 0) };
      }
      if (gid && s.variation_half_id) {
        self.state.variationIndex[gid + '|meia-entrada'] = { variation_id: s.variation_half_id, price: Number(s.price_half || 0) };
      }
    });

    self.state.seatStatus = {};
    (self.state.seatMap.seats || []).forEach(function (s) {
      var key = String(s.id || '').toLowerCase();
      var st  = String(s.status || '').toLowerCase();
      if (st === 'sold' || st === 'reserved') self.state.seatStatus[key] = st;
    });
  };

  LumoSeatPicker.prototype._openModal = function () {
    var self = this;
    if (!self.state.venue || !self.state.layout) return;
    self._buildModal();
    self._renderMap();
    self.dom.modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };

  LumoSeatPicker.prototype._closeModal = function () {
    if (this.dom.modal) this.dom.modal.classList.remove('is-open');
    document.body.style.overflow = '';
  };

  LumoSeatPicker.prototype._renderMap = function () {
    var self = this;
    var v = self.state.venue;
    var layout = self.state.layout;

    // Legenda — padrão: COR = ESTADO (livre/reservada/indisponível/selecionada),
    // grupo de TIPO mostra só os kinds presentes neste teatro, e SETORES lista preço.
    self.dom.legend.innerHTML = '';
    function legChip(html) {
      var c = document.createElement('span');
      c.className = 'lumo-seat-picker__legend-chip';
      c.innerHTML = html;
      self.dom.legend.appendChild(c);
    }
    function legGroup(txt) {
      var s = document.createElement('span');
      s.className = 'lumo-seat-picker__legend-group';
      s.textContent = txt;
      self.dom.legend.appendChild(s);
    }
    function legDot(color) {
      return '<span class="lumo-seat-picker__legend-dot" style="background:' + escapeAttr(color) + '"></span>';
    }
    function legTag(txt, bg, fg) {
      return '<span class="lumo-seat-picker__legend-tag" style="background:' + escapeAttr(bg || '#334155') + ';color:' + escapeAttr(fg || '#f1f5f9') + '">' + escapeHtml(txt) + '</span>';
    }

    // Estado (universal, sempre presente)
    legGroup('Estado');
    legChip(legDot('#3364d0') + '<span>Livre</span>');
    legChip(legDot('#dde94f') + '<span>Reservada</span>');
    legChip(legDot('#a4aedb') + '<span>Indisponível</span>');
    legChip(legDot('#fba45c') + '<span>Selecionada</span>');

    // Tipo de lugar — só os que existem neste teatro
    var kinds = {};
    v.areas.forEach(function (area) {
      (area.rows || []).forEach(function (row) {
        (row.overrides || []).forEach(function (ov) { if (ov.kind) kinds[ov.kind] = true; });
      });
      (area.seats || []).forEach(function (s) { if (s.kind) kinds[s.kind] = true; });
    });
    var hasPillars = !!(v.pillars && v.pillars.length);
    if (kinds.PCR || kinds.AC || kinds.PMR || kinds.PO || hasPillars) {
      legGroup('Tipo de lugar');
      if (kinds.PCR) legChip(legTag('♿', '#a4aedb', '#1b2236') + '<span>Espaço para cadeirante</span>');
      if (kinds.AC) legChip(legTag('AC') + '<span>Acompanhante de Cadeirante</span>');
      if (kinds.PMR) legChip(legTag('PMR') + '<span>Mobilidade Reduzida</span>');
      if (kinds.PO) legChip(legTag('PO') + '<span>Pessoa Obesa</span>');
      if (hasPillars) legChip(legDot('#dc2626') + '<span>Pilar – Vista Prejudicada</span>');
    }

    // Setores + preço (cor não identifica mais setor; nome + preço bastam)
    legGroup('Setores');
    v.areas.forEach(function (area) {
      var pricing = self.state.variationIndex[area.id + '|inteira'];
      var price = pricing ? pricing.price : null;
      var priceLabel;
      if (area.blocked) priceLabel = 'bloqueado';
      else if (price > 0) priceLabel = self.config.currencySymbol + ' ' + price.toFixed(2).replace('.', ',');
      else if (price === 0) priceLabel = 'cortesia';
      else priceLabel = '—';
      legChip('<span>' + escapeHtml(area.name) + '</span>'
        + '<span class="lumo-seat-picker__legend-price">· ' + escapeHtml(priceLabel) + '</span>');
    });

    // SVG
    var svg = self.dom.svg;
    svg.innerHTML = '';
    svg.setAttribute('viewBox', '0 0 ' + layout.width + ' ' + layout.height);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    var root = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(root);

    v.areas.forEach(function (area) {
      var info = layout.areas[area.id];
      if (!info) return;
      if (area.layout === 'rows_with_blocks') drawAreaFrame(root, info, area);
      else if (area.layout === 'single_column') drawColumnAreaLabel(root, info, area);
    });
    if (layout.stage) drawStage(root, layout.stage);

    var computed = computeSeatPositions(layout, v);
    self.state.positions = computed.seats;
    computed.seats.forEach(function (seat) {
      seat.status = self.state.seatStatus[seat.db_seat_id] || 'available';
      // Fallback: kind específico (plateia-pcr) → cai pra área base (plateia)
      // quando o evento não tem variação específica configurada.
      var gid = resolveBackendGroupId(seat, self.state.variationIndex);
      var full = self.state.variationIndex[gid + '|inteira'];
      var half = self.state.variationIndex[gid + '|meia-entrada'];
      seat.pricing = { group_id: gid, full: full || null, half: half || null, has_variation: !!(full || half) };
      // Bloqueia apenas se REALMENTE não há variação nem na base — evita carrinho sem preço
      if (!seat.blocked && !seat.pricing.has_variation) {
        seat.blocked = true;
        seat.blocked_reason = 'Sem preço configurado neste evento';
      }
    });

    computed.rowLabels.forEach(function (lbl) {
      var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('class', 'lumo-seat-picker__row-label');
      t.setAttribute('x', lbl.x); t.setAttribute('y', lbl.y);
      t.textContent = lbl.label;
      root.appendChild(t);
    });

    computed.seats.forEach(function (seat) {
      drawSeat(root, seat, self);
    });

    // Pilares por cima das poltronas (vão aberto entre poltronas adjacentes).
    (computed.pillars || []).forEach(function (p) {
      drawPillar(root, p);
    });

    setTimeout(function () {
      if (self.state.panZoom) { try { self.state.panZoom.destroy(); } catch (e) {} }
      if (typeof svgPanZoom === 'undefined') return;
      self.state.panZoom = svgPanZoom(svg, {
        zoomEnabled: true, controlIconsEnabled: false,
        fit: true, center: true,
        minZoom: 0.5, maxZoom: 8,
        zoomScaleSensitivity: 0.35,
        mouseWheelZoomEnabled: true,
        preventMouseEventsDefault: false,
        customEventsHandler: touchGestureHandler(svg),
      });
    }, 50);
  };

  LumoSeatPicker.prototype._toggleSeat = function (seat, gEl) {
    var self = this;
    if (self.state.selection.has(seat.key)) {
      self.state.selection.delete(seat.key);
      gEl.classList.remove('lumo-seat-picker__seat-group--selected');
    } else {
      self.state.selection.set(seat.key, seat);
      gEl.classList.add('lumo-seat-picker__seat-group--selected');
    }
    self._updateBottomBar();
  };

  LumoSeatPicker.prototype._updateBottomBar = function () {
    var self = this;
    var count = self.state.selection.size;
    var total = 0;
    self.state.selection.forEach(function (seat) {
      total += (seat.pricing && seat.pricing.full ? seat.pricing.full.price : 0);
    });
    self.dom.selectionCount.textContent =
      count === 0 ? 'Toque nas poltronas pra selecionar' :
      count === 1 ? '1 poltrona selecionada' :
      count + ' poltronas selecionadas';
    self.dom.selectionTotal.textContent = self.config.currencySymbol + ' ' + total.toFixed(2).replace('.', ',');
    self.dom.continueBtn.disabled = count === 0;
  };

  LumoSeatPicker.prototype._openSheet = function () {
    var self = this;
    if (self.state.selection.size === 0) return;

    var byArea = new Map();
    self.state.selection.forEach(function (seat) {
      var aid = seat.area_id;
      if (!byArea.has(aid)) {
        byArea.set(aid, {
          area_id: aid, area_name: seat.area_name, area_color: seat.area_color,
          seats: [],
          full_price: (seat.pricing && seat.pricing.full ? seat.pricing.full.price : 0),
          half_price: (seat.pricing && seat.pricing.half ? seat.pricing.half.price : 0),
        });
      }
      byArea.get(aid).seats.push(seat);
    });

    byArea.forEach(function (g, aid) {
      if (!self.state.modalQty.has(aid)) self.state.modalQty.set(aid, 0);
      self.state.modalQty.set(aid, Math.min(self.state.modalQty.get(aid), g.seats.length));
    });
    [].slice.call(self.state.modalQty.keys()).forEach(function (aid) {
      if (!byArea.has(aid)) self.state.modalQty.delete(aid);
    });

    var rows = self.dom.sheet.querySelector('.lumo-seat-picker__qty-rows');
    rows.innerHTML = '';
    byArea.forEach(function (g, aid) {
      var row = document.createElement('div');
      row.className = 'lumo-seat-picker__qty-row';
      row.innerHTML =
        '<div>'
        + '<div class="lumo-seat-picker__qty-label">'
        + '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + escapeAttr(g.area_color) + ';margin-right:8px;vertical-align:middle;"></span>'
        + escapeHtml(g.area_name) + ' · ' + g.seats.length + ' poltrona' + (g.seats.length > 1 ? 's' : '')
        + '</div>'
        + '<div class="lumo-seat-picker__qty-meta">Inteira ' + self.config.currencySymbol + ' ' + g.full_price.toFixed(2).replace('.', ',') + ' · Meia ' + self.config.currencySymbol + ' ' + g.half_price.toFixed(2).replace('.', ',') + '</div>'
        + '</div>'
        + '<div class="lumo-seat-picker__qty-controls">'
        + '<button type="button" class="lumo-seat-picker__qty-btn" data-act="-1" data-area="' + escapeAttr(aid) + '">−</button>'
        + '<span class="lumo-seat-picker__qty-value" data-area="' + escapeAttr(aid) + '">' + self.state.modalQty.get(aid) + '</span>'
        + '<span style="font-size:12px;color:#cbd5e1;">meias</span>'
        + '<button type="button" class="lumo-seat-picker__qty-btn" data-act="+1" data-area="' + escapeAttr(aid) + '">+</button>'
        + '</div>';
      rows.appendChild(row);

      row.querySelectorAll('.lumo-seat-picker__qty-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var aid2 = btn.dataset.area;
          var delta = parseInt(btn.dataset.act, 10);
          var max = byArea.get(aid2).seats.length;
          var cur = self.state.modalQty.get(aid2) || 0;
          var nx = Math.max(0, Math.min(max, cur + delta));
          self.state.modalQty.set(aid2, nx);
          row.querySelector('.lumo-seat-picker__qty-value[data-area="' + aid2 + '"]').textContent = nx;
          self._updateSheetTotal(byArea);
        });
      });
    });

    self._updateSheetTotal(byArea);
    self.state.modalByArea = byArea;
    self.dom.sheet.classList.add('is-open');
  };

  LumoSeatPicker.prototype._updateSheetTotal = function (byArea) {
    var self = this;
    var total = 0;
    byArea.forEach(function (g, aid) {
      var meia = self.state.modalQty.get(aid) || 0;
      var inteira = g.seats.length - meia;
      total += inteira * g.full_price + meia * g.half_price;
    });
    self.dom.sheet.querySelector('.lumo-seat-picker__sheet-summary strong').textContent = self.config.currencySymbol + ' ' + total.toFixed(2).replace('.', ',');
  };

  LumoSeatPicker.prototype._submit = function () {
    var self = this;
    if (!self.state.modalByArea || self.state.selection.size === 0) return;

    var seatsPayload = [];
    self.state.modalByArea.forEach(function (g, aid) {
      var meiaCount = self.state.modalQty.get(aid) || 0;
      g.seats.forEach(function (seat, idx) {
        seatsPayload.push({
          seat: seat,
          ticket_type: idx < meiaCount ? 'meia-entrada' : 'inteira',
        });
      });
    });

    var token = generateUuid();
    self.state.reservationToken = token;
    self.dom.sheet.classList.remove('is-open');
    self._showSubmitting('Reservando poltronas (1/' + seatsPayload.length + ')…');

    var i = 0;
    var chain = Promise.resolve();
    seatsPayload.forEach(function (item) {
      chain = chain.then(function () {
        i++;
        self._updateSubmittingMsg('Reservando poltronas (' + i + '/' + seatsPayload.length + ')…');
        return fetch(self.config.restBase + '/seat-reserve', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id:        self.config.productId,
            seat_id:           item.seat.db_seat_id,
            seat_name:         (item.seat.row_label || '') + item.seat.num,
            group_id:          item.seat.pricing.group_id,
            ticket_type:       item.ticket_type,
            reservation_token: token,
            ttl_seconds:       600,
          }),
        }).then(function (r) {
          return r.json().then(function (body) {
            if (r.status === 409 || body.status === 'error') {
              throw new Error('Poltrona ' + (item.seat.row_label || '') + item.seat.num + ' indisponível: ' + (body.message || ''));
            }
            if (!r.ok) throw new Error('HTTP ' + r.status);
          });
        });
      });
    });

    chain
      .then(function () {
        self._updateSubmittingMsg('Adicionando ao carrinho…');
        return fetch(self.config.restBase + '/seat-add-to-cart', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id:        self.config.productId,
            reservation_token: token,
            seats: seatsPayload.map(function (it) {
              return {
                seat_id:    it.seat.db_seat_id,
                seat_name:  (it.seat.row_label || '') + it.seat.num,
                group_id:   it.seat.pricing.group_id,
                group_name: it.seat.area_name,
                ticket_type: it.ticket_type,
                kind:       it.seat.kind || 'standard',
              };
            }),
          }),
        });
      })
      .then(function (r) {
        return r.json().then(function (body) {
          if (!r.ok || body.status === 'error') throw new Error(body.message || 'HTTP ' + r.status);
          self._updateSubmittingMsg('Tudo certo! Indo pro carrinho…');
          var url = body.redirect_url || self.config.cartUrl;
          setTimeout(function () { window.location.href = url; }, 600);
        });
      })
      .catch(function (e) {
        self._hideSubmitting();
        self._showToast(e.message || 'Erro ao processar', 4000);
      });
  };

  LumoSeatPicker.prototype._showSubmitting = function (msg) {
    this.dom.submittingMsg.textContent = msg || 'Processando…';
    this.dom.submitting.classList.add('is-show');
  };
  LumoSeatPicker.prototype._updateSubmittingMsg = function (msg) {
    this.dom.submittingMsg.textContent = msg;
  };
  LumoSeatPicker.prototype._hideSubmitting = function () {
    this.dom.submitting.classList.remove('is-show');
  };
  LumoSeatPicker.prototype._showToast = function (msg, ms) {
    var t = this.dom.toast;
    t.textContent = msg;
    t.classList.add('is-show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove('is-show'); }, ms || 2200);
  };

  /* =========================================================================
   * MOTOR DE LAYOUT
   * ======================================================================= */
  /**
   * Indexa os pilares por área→fila. Cada pilar fica ENTRE duas poltronas
   * adjacentes de um bloco (between:[a,b]) e ocupa um slot próprio (= seat_size),
   * empurrando as poltronas pra abrir o vão onde fica o pilar.
   */
  function pillarsByRow(venue) {
    var map = {};
    (venue.pillars || []).forEach(function (p) {
      if (!p.area || !p.row || !p.between) return;
      var lo = Math.min(p.between[0], p.between[1]);
      var hi = Math.max(p.between[0], p.between[1]);
      (map[p.area] = map[p.area] || {});
      (map[p.area][p.row] = map[p.area][p.row] || []).push({ lo: lo, hi: hi });
    });
    return map;
  }
  function pillarsInBlock(rowPillars, b) {
    return (rowPillars || []).filter(function (p) { return p.lo >= b.from && p.hi <= b.to; });
  }

  function computeLayout(venue) {
    var r = venue.render;
    var seatStep = r.seat_size + r.seat_gap;
    var rowStep  = r.seat_size + r.row_gap;
    var pillarSlot = r.seat_size;
    var prMap = pillarsByRow(venue);
    var areas = {};

    venue.areas.forEach(function (area) {
      if (area.layout === 'rows_with_blocks') {
        var rowPillarsByLabel = prMap[area.id] || {};
        var rowsInfo = area.rows.map(function (row) {
          var rowPillars = rowPillarsByLabel[row.label] || [];
          var blocksInfo = row.blocks.map(function (b) {
            var pil = pillarsInBlock(rowPillars, b).length;
            return Object.assign({}, b, {
              count: b.to - b.from + 1,
              width: (b.to - b.from + 1) * seatStep - r.seat_gap + pil * pillarSlot,
            });
          });
          var totalWidth = blocksInfo.reduce(function (acc, b) { return acc + b.width; }, 0)
                         + (blocksInfo.length - 1) * r.block_gap;
          return Object.assign({}, row, { blocksInfo: blocksInfo, width: totalWidth });
        });
        var maxWidth = Math.max.apply(null, rowsInfo.map(function (rr) { return rr.width; }));
        var height = rowsInfo.length * rowStep - r.row_gap;
        areas[area.id] = { area: area, rowsInfo: rowsInfo, width: maxWidth, height: height };
      }
    });

    venue.areas.forEach(function (area) {
      if (area.layout === 'single_column') {
        var seats = area.seats || [];
        var w = r.seat_size;
        var h = seats.length * rowStep - r.row_gap;
        areas[area.id] = { area: area, seats: seats, width: w, height: h };
      }
    });

    var PAD_X = 80, PAD_TOP = 30, PAD_BOTTOM = 30;
    var colAreasL = venue.areas.filter(function (a) { return a.layout === 'single_column' && a.anchor && a.anchor.side === 'left'; }).length;
    var colAreasR = venue.areas.filter(function (a) { return a.layout === 'single_column' && a.anchor && a.anchor.side === 'right'; }).length;
    var maxRowsWidth = Math.max.apply(null, [0].concat(Object.keys(areas).filter(function (k) { return areas[k].area.layout === 'rows_with_blocks'; }).map(function (k) { return areas[k].width; })));
    var canvasWidth = maxRowsWidth + PAD_X * 2 + (colAreasL + colAreasR) * (r.seat_size + r.block_gap + 14);

    var yCursor = PAD_TOP;
    var centerX = canvasWidth / 2;

    venue.areas.forEach(function (area) {
      if (area.layout !== 'rows_with_blocks') return;
      var info = areas[area.id];
      info.x = centerX - info.width / 2;
      info.y = yCursor;
      yCursor += info.height + r.area_gap;
    });

    var FRISA_OFFSET = r.seat_size + r.block_gap + 6;
    var lc = { c: 0 }, rc = { c: 0 };
    venue.areas.forEach(function (area) {
      if (area.layout !== 'single_column') return;
      var info = areas[area.id];
      var anchor = area.anchor || {};
      var followArea = anchor.follow_area ? areas[anchor.follow_area] : null;
      if (followArea) info.y = followArea.y + (followArea.height - info.height) / 2;
      else info.y = PAD_TOP;
      if (anchor.side === 'left') {
        var baseX = followArea ? followArea.x : (centerX - maxRowsWidth / 2);
        info.x = baseX - FRISA_OFFSET - (lc.c * (r.seat_size + 14));
        lc.c++;
      } else {
        var baseX2 = followArea ? (followArea.x + followArea.width) : (centerX + maxRowsWidth / 2);
        info.x = baseX2 + r.block_gap + (rc.c * (r.seat_size + 14));
        rc.c++;
      }
    });

    var stage = null;
    if (venue.stage) {
      var follow = venue.stage.follow_area ? areas[venue.stage.follow_area] : null;
      var baseArea = follow || Object.keys(areas).map(function (k) { return areas[k]; }).find(function (a) { return a.area.layout === 'rows_with_blocks'; });
      if (baseArea) {
        var stageH = 32;
        var stageY = venue.stage.position === 'top'
          ? baseArea.y - r.area_gap - stageH
          : baseArea.y + baseArea.height + r.area_gap / 2;
        stage = { x: baseArea.x, y: stageY, width: baseArea.width, height: stageH, label: venue.stage.label || 'PALCO' };
      }
    }

    var maxY = yCursor;
    if (stage) maxY = Math.max(maxY, stage.y + stage.height);
    Object.keys(areas).forEach(function (k) { var info = areas[k]; maxY = Math.max(maxY, info.y + info.height); });
    var canvasHeight = maxY + PAD_BOTTOM;

    return { areas: areas, stage: stage, width: canvasWidth, height: canvasHeight };
  }

  function computeSeatPositions(layout, venue) {
    var r = venue.render;
    var seatStep = r.seat_size + r.seat_gap;
    var rowStep  = r.seat_size + r.row_gap;
    var pillarSlot = r.seat_size;
    var prMap = pillarsByRow(venue);
    var pillars = [];
    var registry = {};

    venue.areas.forEach(function (area) {
      var info = layout.areas[area.id];
      if (!info || area.layout !== 'rows_with_blocks') return;
      registry[area.id] = {};
      var areaPillars = prMap[area.id] || {};

      // rtl: numeração cresce da direita p/ esquerda (poltrona 1 fica à direita).
      // Opcional por área (area.numbering) ou global (render.numbering).
      var rtl = area.numbering === 'rtl' || (venue.render && venue.render.numbering === 'rtl');

      info.rowsInfo.forEach(function (row, rowIdx) {
        var y = info.y + rowIdx * rowStep;
        var x = info.x + (info.width - row.width) / 2;
        var overrides = {};
        (row.overrides || []).forEach(function (ov) { overrides[ov.num] = ov; });
        var rowPillars = areaPillars[row.label] || [];

        var rowBlocks = [];
        row.blocksInfo.forEach(function (block, blockIdx) {
          var blockX = x;
          var blockSeats = [];
          var cnt = block.to - block.from + 1;
          var blockPillars = pillarsInBlock(rowPillars, block);
          for (var i = 0; i < cnt; i++) {
            // x sempre cresce; em rtl o número decresce (block.to ... block.from).
            var n = rtl ? (block.to - i) : (block.from + i);
            var ov = overrides[n] || {};
            var seat = {
              area_id: area.id, area_name: area.name, area_color: area.color,
              row_label: row.label, num: n,
              x: x, y: y, w: r.seat_size, h: r.seat_size,
              kind: ov.kind || 'standard',
              blocked: ov.blocked === true || block.blocked === true || row.blocked === true,
              blocked_reason: row.blocked_reason || block.blocked_reason || ov.blocked_reason || null,
              // hold = reserva da casa (ex.: cortesia FCC): indisponível pro comprador,
              // mas emissível pela ticketeira (não é bloqueio permanente).
              hold: ov.hold || block.hold || row.hold || null,
              hold_reason: ov.hold_reason || block.hold_reason || row.hold_reason || null,
              key: area.id + '|' + row.label + '|' + n,
              shape: r.shape,
              db_seat_id: (row.label + n).toLowerCase(),
            };
            blockSeats.push(seat);
            var seatX = x;
            x += seatStep;
            // Pilar logo após esta poltrona? (entre poltronas adjacentes do bloco)
            blockPillars.forEach(function (p) {
              var gapAfter = rtl ? p.hi : p.lo; // primeira desenhada do par
              if (gapAfter === n) {
                pillars.push({
                  x: seatX + r.seat_size + (r.seat_gap + pillarSlot) / 2,
                  y: y + r.seat_size / 2,
                  r: pillarSlot * 0.4,
                });
                x += pillarSlot;
              }
            });
          }
          rowBlocks.push({ from: block.from, to: block.to, x: blockX, width: block.width, y: y, seats: blockSeats });
          if (blockIdx < row.blocksInfo.length - 1) x += r.block_gap - r.seat_gap;
        });
        registry[area.id][row.label] = rowBlocks;
      });
    });

    venue.areas.forEach(function (area) {
      if (area.layout !== 'rows_with_blocks') return;
      var info = layout.areas[area.id];
      info.rowsInfo.forEach(function (row) {
        row.blocksInfo.forEach(function (block, blockIdx) {
          var ref = block.align_to;
          if (!ref || !ref.row) return;
          var refRowBlocks = registry[area.id][ref.row];
          if (!refRowBlocks) return;
          var refMinX = Infinity, refMaxX = -Infinity;
          refRowBlocks.forEach(function (rb) {
            rb.seats.forEach(function (s) {
              if (s.num >= ref.from && s.num <= ref.to) {
                if (s.x < refMinX) refMinX = s.x;
                if (s.x + s.w > refMaxX) refMaxX = s.x + s.w;
              }
            });
          });
          if (refMinX === Infinity) return;
          var refCenterX = (refMinX + refMaxX) / 2;
          var curBlock = registry[area.id][row.label][blockIdx];
          var delta = refCenterX - (curBlock.x + curBlock.width / 2);
          curBlock.x += delta;
          curBlock.seats.forEach(function (s) { s.x += delta; });
        });
      });
    });

    var seats = [];
    var rowLabels = [];
    Object.keys(registry).forEach(function (areaId) {
      Object.keys(registry[areaId]).forEach(function (rowLabel) {
        registry[areaId][rowLabel].forEach(function (block) {
          block.seats.forEach(function (s) { seats.push(s); });
          var y = block.y + r.seat_size / 2;
          rowLabels.push({ x: block.x - r.row_label_offset, y: y, label: rowLabel });
          rowLabels.push({ x: block.x + block.width + r.row_label_offset, y: y, label: rowLabel });
        });
      });
    });

    venue.areas.forEach(function (area) {
      if (area.layout !== 'single_column') return;
      var info = layout.areas[area.id];
      info.seats.forEach(function (s, idx) {
        var isBlocked = s.blocked === true || area.blocked === true;
        seats.push({
          area_id: area.id, area_name: area.name, area_color: area.color,
          row_label: '', num: s.num,
          x: info.x, y: info.y + idx * rowStep,
          w: r.seat_size, h: r.seat_size,
          kind: s.kind || 'standard',
          blocked: isBlocked,
          blocked_reason: area.blocked_reason || s.blocked_reason || null,
          key: area.id + '|' + s.num,
          shape: r.shape,
          db_seat_id: (area.id.replace('frisa_', '') + s.num).toLowerCase(),
        });
      });
    });

    return { seats: seats, rowLabels: rowLabels, pillars: pillars };
  }

  /**
   * Resolve group_id pra lookup de variação no backend.
   * Cadeiras acessíveis (PCR/PMR/AC/PO) usam fallback pra área base SEMPRE que
   * a variação específica não tem preço configurado (>0). Isso garante:
   *   - Por padrão: acessibilidade herda o preço da área base (Plateia/Mezanino).
   *   - Se o produtor setar preço específico (ex: R$ 1 acessível social), respeita.
   */
  function resolveBackendGroupId(seat, variationIndex) {
    if (seat.kind && seat.kind !== 'standard') {
      var withKind = seat.area_id + '-' + seat.kind;
      var fullKind = variationIndex[withKind + '|inteira'];
      var halfKind = variationIndex[withKind + '|meia-entrada'];
      var hasRealPrice = (fullKind && fullKind.price > 0) || (halfKind && halfKind.price > 0);
      if (hasRealPrice) return withKind;
    }
    return seat.area_id;
  }

  /* ---------- Render helpers ------------------------------------------------ */
  function drawAreaFrame(parent, info, area) {
    var PAD = 8;
    var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', info.x - PAD); rect.setAttribute('y', info.y - PAD - 16);
    rect.setAttribute('width', info.width + PAD * 2); rect.setAttribute('height', info.height + PAD * 2 + 16);
    rect.setAttribute('rx', 8);
    rect.setAttribute('class', 'lumo-seat-picker__area-frame');
    parent.appendChild(rect);
    var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('class', 'lumo-seat-picker__area-label');
    label.setAttribute('x', info.x + info.width / 2); label.setAttribute('y', info.y - 12);
    label.setAttribute('fill', area.color);
    label.textContent = area.name.toUpperCase();
    parent.appendChild(label);
  }
  function drawColumnAreaLabel(parent, info, area) {
    var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('class', 'lumo-seat-picker__area-label');
    label.setAttribute('x', info.x + info.width / 2); label.setAttribute('y', info.y - 12);
    label.setAttribute('fill', area.color);
    label.setAttribute('style', 'font-size:8px; letter-spacing:1.5px;');
    label.textContent = area.name.toUpperCase();
    parent.appendChild(label);
  }
  function drawStage(parent, stage) {
    var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', stage.x); rect.setAttribute('y', stage.y);
    rect.setAttribute('width', stage.width); rect.setAttribute('height', stage.height);
    rect.setAttribute('rx', 6); rect.setAttribute('class', 'lumo-seat-picker__stage-rect');
    parent.appendChild(rect);
    var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('class', 'lumo-seat-picker__stage-label');
    t.setAttribute('x', stage.x + stage.width / 2); t.setAttribute('y', stage.y + stage.height / 2);
    t.textContent = stage.label;
    parent.appendChild(t);
  }

  function drawPillar(parent, p) {
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'lumo-seat-picker__pillar');
    var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', p.r);
    g.appendChild(c);
    var title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = 'Pilar — vista prejudicada';
    g.appendChild(title);
    parent.appendChild(g);
  }

  /**
   * Cria <g> wrapper com shape + label + classes de estado.
   * Listener de click no <g> para evitar acertar só o text/shape.
   */
  function drawSeat(parent, seat, instance) {
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    var isSold = seat.status === 'sold';
    var isReserved = seat.status === 'reserved';
    var isHold = !!seat.hold;
    var isAccessible = seat.kind && seat.kind !== 'standard';
    var isUnavail = seat.blocked || isSold || isReserved || isHold;

    var cls = 'lumo-seat-picker__seat-group';
    if (isHold) cls += ' lumo-seat-picker__seat-group--hold';
    else if (seat.blocked) cls += ' lumo-seat-picker__seat-group--blocked';
    else if (isSold) cls += ' lumo-seat-picker__seat-group--sold';
    else if (isReserved) cls += ' lumo-seat-picker__seat-group--reserved';
    if (isAccessible) cls += ' lumo-seat-picker__seat-group--accessible';
    if (seat.kind) cls += ' lumo-seat-picker__seat-group--kind-' + seat.kind;
    if (isUnavail) cls += ' lumo-seat-picker__seat-group--unavailable';
    g.setAttribute('class', cls);

    var shape;
    if (seat.shape === 'circle') {
      shape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      shape.setAttribute('cx', seat.x + seat.w / 2); shape.setAttribute('cy', seat.y + seat.h / 2);
      shape.setAttribute('r', Math.min(seat.w, seat.h) / 2);
    } else {
      shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      shape.setAttribute('x', seat.x); shape.setAttribute('y', seat.y);
      shape.setAttribute('width', seat.w); shape.setAttribute('height', seat.h);
      shape.setAttribute('rx', seat.shape === 'rounded' ? 3 : 0);
    }
    // cor base = ESTADO livre (definida no CSS); estados/kind sobrescrevem via classe.
    shape.setAttribute('stroke', 'rgba(0,0,0,0.25)');
    shape.setAttribute('stroke-width', '0.5');
    shape.setAttribute('class', 'lumo-seat-picker__seat');
    g.appendChild(shape);

    // Marcador: poltronas de acessibilidade mostram o tipo no lugar do número.
    var glyph = null, glyphSize = null;
    if (seat.kind === 'PCR') { glyph = '♿'; glyphSize = 9; }
    else if (seat.kind === 'AC') { glyph = 'AC'; glyphSize = 5.5; }
    else if (seat.kind === 'PMR') { glyph = 'PMR'; glyphSize = 5; }
    else if (seat.kind === 'PO') { glyph = 'PO'; glyphSize = 6; }
    if (glyph || seat.num) {
      var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('class', 'lumo-seat-picker__seat-label');
      t.setAttribute('x', seat.x + seat.w / 2);
      t.setAttribute('y', seat.y + seat.h / 2);
      if (glyphSize) t.setAttribute('style', 'font-size:' + glyphSize + 'px;');
      t.textContent = glyph || String(seat.num);
      g.appendChild(t);
    }

    g.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (isUnavail) {
        var msg = isHold ? (seat.hold_reason || 'Reservada (cortesia)') :
                  seat.blocked ? (seat.blocked_reason || 'Bloqueada') :
                  isSold ? 'Vendida' :
                  isReserved ? 'Reservada por outro cliente' : 'Indisponível';
        instance._showToast(msg, 1600);
        return;
      }
      instance._toggleSeat(seat, g);
    });

    parent.appendChild(g);
  }

  /* ---------- Touch gestures: 1 dedo = pan, 2 dedos = zoom ----------------- */
  function touchGestureHandler(svgEl) {
    return {
      haltEventListeners: ['touchstart', 'touchend', 'touchmove', 'touchleave', 'touchcancel'],
      init: function (options) {
        var instance = options.instance;
        var pointerMap = new Map();
        var pinch = null;
        var pan = null;
        var PAN_THRESHOLD = 4; // px antes de comprometer com pan (deixa tap puro funcionar)
        var dist = function (a, b) { return Math.hypot(b.x - a.x, b.y - a.y); };

        this.start = function (ev) {
          for (var i = 0; i < ev.touches.length; i++) {
            var t = ev.touches[i];
            pointerMap.set(t.identifier, { x: t.clientX, y: t.clientY });
          }
          if (pointerMap.size === 2) {
            pan = null;
            var arr = []; pointerMap.forEach(function (p) { arr.push(p); });
            pinch = {
              startDist: dist(arr[0], arr[1]),
              initialZoom: instance.getZoom(),
              midX: (arr[0].x + arr[1].x) / 2,
              midY: (arr[0].y + arr[1].y) / 2,
            };
            ev.preventDefault(); ev.stopPropagation();
          } else if (pointerMap.size === 1) {
            var t0 = ev.touches[0];
            pan = { startX: t0.clientX, startY: t0.clientY, lastX: t0.clientX, lastY: t0.clientY, started: false };
            // Não preventDefault aqui — permite que click funcione caso seja apenas tap.
          }
        };
        this.move = function (ev) {
          for (var i = 0; i < ev.touches.length; i++) {
            var t = ev.touches[i];
            pointerMap.set(t.identifier, { x: t.clientX, y: t.clientY });
          }
          if (pinch && pointerMap.size === 2) {
            var arr = []; pointerMap.forEach(function (p) { arr.push(p); });
            var curDist = dist(arr[0], arr[1]);
            var nz = Math.max(0.5, Math.min(8, pinch.initialZoom * (curDist / pinch.startDist)));
            var r = svgEl.getBoundingClientRect();
            instance.zoomAtPoint(nz, { x: pinch.midX - r.left, y: pinch.midY - r.top });
            ev.preventDefault(); ev.stopPropagation();
            return;
          }
          if (pan && pointerMap.size === 1) {
            var t1 = ev.touches[0];
            if (!pan.started) {
              var moved = Math.hypot(t1.clientX - pan.startX, t1.clientY - pan.startY);
              if (moved < PAN_THRESHOLD) return;
              pan.started = true;
            }
            var dx = t1.clientX - pan.lastX;
            var dy = t1.clientY - pan.lastY;
            instance.panBy({ x: dx, y: dy });
            pan.lastX = t1.clientX;
            pan.lastY = t1.clientY;
            ev.preventDefault(); ev.stopPropagation();
          }
        };
        this.end = function (ev) {
          var remaining = new Set();
          for (var i = 0; i < ev.touches.length; i++) remaining.add(ev.touches[i].identifier);
          var toDelete = [];
          pointerMap.forEach(function (_, id) { if (!remaining.has(id)) toDelete.push(id); });
          toDelete.forEach(function (id) { pointerMap.delete(id); });
          if (pointerMap.size < 2) pinch = null;
          if (pointerMap.size < 1) pan = null;
        };
        svgEl.addEventListener('touchstart',  this.start, { passive: false });
        svgEl.addEventListener('touchmove',   this.move,  { passive: false });
        svgEl.addEventListener('touchend',    this.end,   { passive: true });
        svgEl.addEventListener('touchcancel', this.end,   { passive: true });
      },
      destroy: function () {},
    };
  }

  /* ---------- Utils -------------------------------------------------------- */
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]); }); }
  function escapeAttr(s) { return escapeHtml(s); }
  function generateUuid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'res-' + Date.now() + '-' + Math.random().toString(36).slice(2); }

  // Expõe para uso externo (React SeatPickerWidget)
  window.LumoSeatPicker = LumoSeatPicker;
  window.LumoSeatPickerBoot = boot;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
