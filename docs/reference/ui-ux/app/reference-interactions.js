(() => {
  'use strict';

  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const storage = {
    get(key) {
      try { return window.localStorage.getItem(key); } catch (_) { return null; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, value); } catch (_) { /* offline file mode */ }
    },
  };

  function toast(message, tone = 'info') {
    let stack = qs('.reference-toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'reference-toast-stack';
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }

    const item = document.createElement('div');
    item.className = `reference-toast reference-toast--${tone}`;
    item.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    item.textContent = message;
    stack.appendChild(item);
    window.setTimeout(() => item.remove(), 3200);
  }

  function setupNavigation() {
    const toggle = qs('.sidebar-toggle');
    if (!toggle) return;

    const applyCollapsed = (collapsed) => {
      document.body.classList.toggle('nav-collapsed', collapsed);
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.setAttribute('aria-label', collapsed ? 'Expand navigation' : 'Collapse navigation');
      toggle.title = collapsed ? 'Expand navigation' : 'Collapse navigation';
      const icon = qs('span', toggle);
      if (icon) icon.textContent = collapsed ? '›' : '‹';
      storage.set('recruitflow-reference-nav-collapsed', collapsed ? '1' : '0');
    };

    applyCollapsed(storage.get('recruitflow-reference-nav-collapsed') === '1');
    toggle.addEventListener('click', () => {
      applyCollapsed(!document.body.classList.contains('nav-collapsed'));
    });

    qsa('.nav a').forEach((link) => {
      if (!link.getAttribute('title')) link.title = link.textContent.trim();
    });
  }

  function closePalette() {
    const palette = qs('.reference-command-palette');
    if (palette) palette.remove();
  }

  function setupCommandSearch() {
    const search = qs('.header .search');
    if (!search) return;

    search.setAttribute('role', 'button');
    search.setAttribute('tabindex', '0');
    search.setAttribute('aria-label', 'Open command search');

    const openPalette = () => {
      closePalette();
      const overlay = document.createElement('div');
      overlay.className = 'reference-command-palette';
      overlay.setAttribute('role', 'presentation');

      const panel = document.createElement('section');
      panel.className = 'reference-command-panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-labelledby', 'reference-command-title');

      const heading = document.createElement('div');
      heading.className = 'reference-command-heading';
      heading.innerHTML = '<div><span class="eyebrow">RecruitFlow command center</span><b id="reference-command-title">Search the reference app</b></div><button type="button" class="icon-btn" aria-label="Close command search">×</button>';
      panel.appendChild(heading);

      const input = document.createElement('input');
      input.className = 'reference-command-input';
      input.type = 'search';
      input.placeholder = 'Search screens, candidates, vacancies, or actions…';
      input.setAttribute('aria-label', 'Search reference screens');
      panel.appendChild(input);

      const results = document.createElement('div');
      results.className = 'reference-command-results';
      panel.appendChild(results);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      const entries = qsa('.nav a, .gallery-card').map((link) => ({
        title: (link.querySelector('h3, span:last-child') || link).textContent.trim(),
        meta: link.getAttribute('data-chapter') || (link.querySelector('p') || {}).textContent || 'Reference screen',
        href: link.getAttribute('href') || '#',
      }));

      const render = (query = '') => {
        const normalized = query.trim().toLowerCase();
        const matches = entries.filter((entry) => `${entry.title} ${entry.meta}`.toLowerCase().includes(normalized)).slice(0, 8);
        results.replaceChildren();
        if (!matches.length) {
          const empty = document.createElement('div');
          empty.className = 'reference-command-empty';
          empty.textContent = 'No reference surface matches that search.';
          results.appendChild(empty);
          return;
        }
        matches.forEach((entry) => {
          const result = document.createElement('a');
          result.className = 'reference-command-result';
          result.href = entry.href;
          const title = document.createElement('b');
          title.textContent = entry.title;
          const meta = document.createElement('small');
          meta.textContent = entry.meta;
          result.append(title, meta);
          results.appendChild(result);
        });
      };

      render();
      input.addEventListener('input', () => render(input.value));
      qs('button', heading).addEventListener('click', closePalette);
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closePalette();
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closePalette();
      });
      window.setTimeout(() => input.focus(), 0);
    };

    search.addEventListener('click', openPalette);
    search.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPalette();
      }
    });
    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openPalette();
      }
      if (event.key === 'Escape') closePalette();
    });
  }

  function activateGroup(target, selector, className = 'active') {
    const group = target.closest('[role="tablist"], [role="group"], .tabs, .segmented, .saved-views, .interview-calendar-view-switch');
    if (!group) return;
    qsa(selector, group).forEach((item) => {
      item.classList.remove(className);
      if (item.hasAttribute('aria-selected')) item.setAttribute('aria-selected', 'false');
      if (item.hasAttribute('aria-pressed')) item.setAttribute('aria-pressed', 'false');
    });
    target.classList.add(className);
    if (target.hasAttribute('aria-selected')) target.setAttribute('aria-selected', 'true');
    if (target.hasAttribute('aria-pressed')) target.setAttribute('aria-pressed', 'true');
  }

  function setupControls() {
    qsa('.density').forEach((item) => {
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      const choose = () => {
        qsa('.density').forEach((candidate) => candidate.classList.remove('active'));
        item.classList.add('active');
        document.body.dataset.density = item.textContent.trim().toLowerCase();
        toast(`${item.textContent.trim()} density selected`);
      };
      item.addEventListener('click', choose);
      item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); }
      });
    });

    qsa('.token-swatch').forEach((item) => {
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      const copy = async () => {
        const swatch = qs('span', item);
        const color = swatch ? (swatch.style.background || swatch.style.backgroundColor) : '';
        const label = (qs('b', item) || {}).textContent || 'Token';
        if (color) {
          try { await navigator.clipboard.writeText(color); } catch (_) { /* file:// clipboard may be unavailable */ }
          toast(`${label}: ${color} copied`);
        }
      };
      item.addEventListener('click', copy);
      item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); copy(); }
      });
    });

    qsa('.field-toggle[role="switch"]').forEach((toggle) => {
      toggle.addEventListener('click', () => {
        const enabled = toggle.getAttribute('aria-checked') !== 'true';
        toggle.setAttribute('aria-checked', String(enabled));
        toggle.classList.toggle('is-on', enabled);
        toast(`${toggle.getAttribute('aria-label') || 'Setting'} ${enabled ? 'enabled' : 'disabled'}`);
      });
    });

    qsa('.tab-item').forEach((tab) => tab.addEventListener('click', () => {
      activateGroup(tab, '.tab-item');
      toast(`${tab.textContent.trim()} view selected`);
    }));
    qsa('.segmented-option, .saved-view, .interview-calendar-view-switch button').forEach((item) => item.addEventListener('click', () => {
      activateGroup(item, item.classList.contains('saved-view') ? '.saved-view' : item.classList.contains('segmented-option') ? '.segmented-option' : 'button');
      toast(`${item.textContent.trim()} view selected`);
    }));
    qsa('.recommendation-option').forEach((item) => item.addEventListener('click', () => {
      activateGroup(item, '.recommendation-option');
      toast(`${item.textContent.trim()} recommendation selected`);
    }));

    qsa('.rating-scale button').forEach((item) => item.addEventListener('click', () => {
      const group = item.closest('.rating-scale');
      qsa('button', group).forEach((candidate) => {
        candidate.classList.remove('selected');
        candidate.setAttribute('aria-checked', 'false');
      });
      item.classList.add('selected');
      item.setAttribute('aria-checked', 'true');
    }));

    qsa('.accordion-trigger').forEach((trigger) => trigger.addEventListener('click', () => {
      const id = trigger.getAttribute('aria-controls');
      const panel = id && document.getElementById(id);
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!expanded));
      if (panel) panel.classList.toggle('collapsed', expanded);
    }));

    qsa('.demo-sidebar-item:not(.restricted)').forEach((item) => item.addEventListener('click', () => {
      qsa('.demo-sidebar-item').forEach((candidate) => candidate.classList.remove('selected'));
      item.classList.add('selected');
      toast(`${item.textContent.trim()} selected`);
    }));
  }

  function setupTables() {
    const summary = qs('#table-selection-summary');
    const checkboxes = qsa('.table-select');
    const update = () => {
      const rowCheckboxes = qsa('tbody .table-select');
      const selected = rowCheckboxes.filter((checkbox) => checkbox.checked);
      rowCheckboxes.forEach((checkbox) => {
        const row = checkbox.closest('tr');
        if (!row) return;
        row.classList.toggle('is-selected', checkbox.checked);
        row.setAttribute('aria-selected', String(checkbox.checked));
      });
      if (summary) summary.textContent = `${selected.length} selected`;
      const selectAll = qs('thead .table-select');
      if (selectAll) {
        selectAll.checked = rowCheckboxes.length > 0 && selected.length === rowCheckboxes.length;
        selectAll.indeterminate = selected.length > 0 && selected.length < rowCheckboxes.length;
      }
    };
    checkboxes.forEach((checkbox) => checkbox.addEventListener('change', () => {
      if (checkbox.closest('thead')) {
        qsa('tbody .table-select').forEach((rowCheckbox) => { rowCheckbox.checked = checkbox.checked; });
      }
      update();
    }));
    update();
  }

  function setupGallery() {
    const search = qs('#gallery-search');
    const cards = qsa('.gallery-card');
    const resultCount = qs('#gallery-result-count');
    const activeFilters = new Set(['all']);

    const render = () => {
      const query = search ? search.value.trim().toLowerCase() : '';
      const visible = cards.filter((card) => {
        const matchesQuery = !query || card.textContent.toLowerCase().includes(query);
        const chapter = card.dataset.chapter || 'Reference Anatomy';
        const matchesFilter = activeFilters.has('all') || activeFilters.has(chapter);
        card.classList.toggle('is-hidden', !(matchesQuery && matchesFilter));
        return matchesQuery && matchesFilter;
      });
      if (resultCount) resultCount.textContent = `${visible.length} screens`; 
      const empty = qs('.gallery-empty');
      if (empty) empty.hidden = visible.length !== 0;
    };

    if (search) search.addEventListener('input', render);
    qsa('.gallery-filter').forEach((filter) => filter.addEventListener('click', () => {
      const value = filter.dataset.filter || 'all';
      qsa('.gallery-filter').forEach((candidate) => candidate.classList.remove('is-active'));
      filter.classList.add('is-active');
      activeFilters.clear();
      activeFilters.add(value);
      render();
    }));
    render();
  }

  function setupGeneralActions() {
    qsa('a[href="#"]').forEach((link) => link.addEventListener('click', (event) => {
      event.preventDefault();
      toast(`${link.textContent.trim() || 'Action'} is ready for the live product contract`);
    }));

    qsa('input[type="file"]').forEach((input) => input.addEventListener('change', () => {
      const count = input.files ? input.files.length : 0;
      if (count) toast(`${count} file${count === 1 ? '' : 's'} selected`);
    }));

    qsa('.modal-demo-close').forEach((button) => button.addEventListener('click', () => {
      const modal = button.closest('.modal-demo');
      if (modal) modal.hidden = true;
      toast('Dialog closed');
    }));

    qsa('.comment-composer .btn').forEach((button) => button.addEventListener('click', () => {
      const editor = qs('.comment-editor', button.closest('.comment-composer'));
      const text = editor ? editor.textContent.trim() : '';
      if (!text || text.startsWith('Write a note')) {
        toast('Add a note before posting', 'error');
        return;
      }
      toast('Comment posted to the activity thread', 'success');
      if (editor) editor.textContent = 'Write a note and mention @someone…';
    }));
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupCommandSearch();
    setupControls();
    setupTables();
    setupGallery();
    setupGeneralActions();
  });
})();
