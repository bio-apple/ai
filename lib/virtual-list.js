/**
 * 轻量虚拟列表：仅渲染可视区 + overscan，滚动用 rAF；大批量更新可分片不卡主线程。
 * 用法：window.BioAI.createVirtualList({ container, items, renderItem, itemHeight })
 */
(function initVirtualList() {
  const BioAI = (window.BioAI = window.BioAI || {});

  function schedule(fn) {
    if (typeof requestIdleCallback === 'function') {
      return requestIdleCallback(fn, { timeout: 48 });
    }
    return setTimeout(fn, 0);
  }

  /**
   * 分片映射，避免一次 map/join 上千条阻塞主线程。
   * @template T, R
   * @param {T[]} items
   * @param {(item: T, index: number) => R} mapper
   * @param {{ chunkSize?: number, onProgress?: (done: number, total: number) => void }} [opts]
   * @returns {Promise<R[]>}
   */
  function mapInChunks(items, mapper, opts = {}) {
    const chunkSize = opts.chunkSize || 40;
    const list = items || [];
    const out = new Array(list.length);
    let i = 0;
    return new Promise((resolve) => {
      function step() {
        const end = Math.min(i + chunkSize, list.length);
        for (; i < end; i += 1) out[i] = mapper(list[i], i);
        opts.onProgress?.(i, list.length);
        if (i >= list.length) {
          resolve(out);
          return;
        }
        schedule(step);
      }
      if (!list.length) {
        resolve(out);
        return;
      }
      schedule(step);
    });
  }

  /**
   * @param {object} options
   * @param {HTMLElement} options.container
   * @param {unknown[]} options.items
   * @param {(item: unknown, index: number) => string|HTMLElement} options.renderItem
   * @param {number} [options.itemHeight=72] 行高（list）或卡片高度（grid）
   * @param {number} [options.overscan=6]
   * @param {'list'|'grid'} [options.layout='list']
   * @param {number} [options.minItemWidth=280] grid 最小列宽
   * @param {number} [options.gap=16]
   * @param {string} [options.itemClass='']
   * @param {() => void} [options.onRangeChange]
   */
  function createVirtualList(options) {
    const container = options.container;
    if (!container) throw new Error('createVirtualList: container required');

    let items = Array.isArray(options.items) ? options.items : [];
    let itemHeight = Math.max(1, Number(options.itemHeight) || 72);
    let overscan = Math.max(0, Number(options.overscan) || 6);
    const layout = options.layout === 'grid' ? 'grid' : 'list';
    const minItemWidth = Math.max(120, Number(options.minItemWidth) || 280);
    const gap = Math.max(0, Number(options.gap) || 16);
    const renderItem = options.renderItem;
    const itemClass = options.itemClass || '';

    container.classList.add('vl-root');
    container.innerHTML = '';

    const spacer = document.createElement('div');
    spacer.className = 'vl-spacer';
    spacer.setAttribute('aria-hidden', 'true');

    const windowEl = document.createElement('div');
    windowEl.className = 'vl-window';
    windowEl.setAttribute('role', 'list');

    container.append(spacer, windowEl);

    let columns = 1;
    let rafId = 0;
    let resizeObs = null;
    let destroyed = false;
    let rangeStart = 0;
    let rangeEnd = 0;

    function measureColumns() {
      if (layout !== 'grid') {
        columns = 1;
        return;
      }
      const width = container.clientWidth || container.parentElement?.clientWidth || minItemWidth;
      columns = Math.max(1, Math.floor((width + gap) / (minItemWidth + gap)));
    }

    function rowCount() {
      return Math.ceil(items.length / columns) || 0;
    }

    function totalHeight() {
      const rows = rowCount();
      if (!rows) return 0;
      return rows * itemHeight + Math.max(0, rows - 1) * gap;
    }

    function syncSpacer() {
      spacer.style.height = `${totalHeight()}px`;
    }

    function visibleRange() {
      const scrollTop = container.scrollTop;
      // 首帧或隐藏 Tab 时 clientHeight 可能为 0，用最小可视高度兜底，避免画出 0 条
      const rawH = container.clientHeight || 0;
      const viewH = rawH > 0 ? rawH : Math.max(itemHeight * 2, 280);
      const stride = itemHeight + gap;
      const firstRow = Math.max(0, Math.floor(scrollTop / stride) - overscan);
      const lastRow = Math.min(rowCount() - 1, Math.ceil((scrollTop + viewH) / stride) + overscan);
      const start = firstRow * columns;
      const end = Math.min(items.length, (lastRow + 1) * columns);
      return { start, end, firstRow };
    }

    function paint() {
      if (destroyed) return;
      rafId = 0;
      measureColumns();
      syncSpacer();

      if (!items.length) {
        windowEl.innerHTML = '';
        windowEl.style.transform = '';
        rangeStart = 0;
        rangeEnd = 0;
        return;
      }

      const { start, end, firstRow } = visibleRange();
      if (start === rangeStart && end === rangeEnd && windowEl.childNodes.length) {
        return;
      }
      rangeStart = start;
      rangeEnd = end;

      const offsetY = firstRow * (itemHeight + gap);
      windowEl.style.transform = `translateY(${offsetY}px)`;

      if (layout === 'grid') {
        windowEl.style.display = 'grid';
        windowEl.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
        windowEl.style.gap = `${gap}px`;
      } else {
        windowEl.style.display = 'flex';
        windowEl.style.flexDirection = 'column';
        windowEl.style.gap = `${gap}px`;
        windowEl.style.gridTemplateColumns = '';
      }

      const frag = document.createDocumentFragment();
      for (let i = start; i < end; i += 1) {
        const htmlOrNode = renderItem(items[i], i);
        let el;
        if (htmlOrNode instanceof HTMLElement) {
          el = htmlOrNode;
        } else {
          const wrap = document.createElement('div');
          wrap.innerHTML = String(htmlOrNode || '').trim();
          el = wrap.firstElementChild || wrap;
        }
        el.setAttribute('role', 'listitem');
        el.dataset.vlIndex = String(i);
        if (itemClass) el.classList.add(...itemClass.split(/\s+/).filter(Boolean));
        if (layout === 'list') {
          el.style.minHeight = `${itemHeight}px`;
        } else {
          el.style.minHeight = `${itemHeight}px`;
        }
        frag.appendChild(el);
      }
      windowEl.replaceChildren(frag);
      options.onRangeChange?.({ start, end, total: items.length });
    }

    function schedulePaint() {
      if (destroyed || rafId) return;
      rafId = requestAnimationFrame(paint);
    }

    function onScroll() {
      schedulePaint();
    }

    function setItems(nextItems, opts = {}) {
      items = Array.isArray(nextItems) ? nextItems : [];
      rangeStart = -1;
      rangeEnd = -1;
      if (opts.resetScroll) container.scrollTop = 0;
      if (opts.itemHeight) itemHeight = Math.max(1, Number(opts.itemHeight) || itemHeight);
      schedulePaint();
    }

    function destroy() {
      destroyed = true;
      if (rafId) cancelAnimationFrame(rafId);
      container.removeEventListener('scroll', onScroll);
      resizeObs?.disconnect();
      container.classList.remove('vl-root');
      container.innerHTML = '';
    }

    container.addEventListener('scroll', onScroll, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      resizeObs = new ResizeObserver(() => {
        rangeStart = -1;
        schedulePaint();
      });
      resizeObs.observe(container);
    } else {
      window.addEventListener('resize', schedulePaint);
    }

    // 首帧：先设高度，再空闲时绘制，避免阻塞导航切换
    measureColumns();
    syncSpacer();
    schedulePaint();

    return {
      setItems,
      destroy,
      refresh: schedulePaint,
      get items() {
        return items;
      },
      get visibleRange() {
        return { start: rangeStart, end: rangeEnd };
      },
    };
  }

  BioAI.createVirtualList = createVirtualList;
  BioAI.mapInChunks = mapInChunks;

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  /** 首页 GitHub 热门：虚拟列表接管，可扩展至上千条不卡顿 */
  function bootGithubHotList() {
    const host = document.querySelector('[data-github-vl]');
    const dataEl = document.getElementById('daily-github-data');
    if (!host || !dataEl) return;
    let items = [];
    try {
      items = JSON.parse(dataEl.textContent || '[]');
    } catch {
      return;
    }
    if (!Array.isArray(items) || !items.length) return;

    host.innerHTML = '';
    createVirtualList({
      container: host,
      items,
      layout: 'list',
      itemHeight: 52,
      gap: 0,
      overscan: 6,
      renderItem: (item) => `
        <div class="daily-vl-row">
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer"
            data-track="daily_panel_click" data-track-panel="github">
            <span class="daily-item-title">${escapeHtml(item.title)}</span>
            <span class="daily-item-meta">${escapeHtml(item.meta || 'GitHub')}</span>
          </a>
        </div>
      `,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootGithubHotList);
  } else {
    bootGithubHotList();
  }
})();
