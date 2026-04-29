(function () {
  "use strict";

  const REGISTRY_KEY = "tabs.switch.basic-v1";
  const instances = new WeakMap();

  function toArray(value) {
    return Array.prototype.slice.call(value || []);
  }

  function clampIndex(index, count) {
    if (!count) return 0;
    const next = Number(index || 0);
    if (!Number.isFinite(next)) return 0;
    return Math.max(0, Math.min(count - 1, next));
  }

  function findTabs(root) {
    return toArray(root.querySelectorAll("[data-tabs-tab]"));
  }

  function findPanels(root) {
    return toArray(root.querySelectorAll("[data-tabs-panel]"));
  }

  function readIndexFromElement(element, attrName, fallbackIndex) {
    const rawValue = element.getAttribute(attrName);
    const parsed = rawValue === "" || rawValue == null ? fallbackIndex : Number(rawValue);
    return Number.isFinite(parsed) ? parsed : fallbackIndex;
  }

  function ensureA11y(root, tabs, panels) {
    if (!root.getAttribute("role")) root.setAttribute("role", "tablist");
    tabs.forEach((tab, index) => {
      if (!tab.id) tab.id = `clone-tabs-tab-${Date.now()}-${index}`;
      if (!tab.getAttribute("role")) tab.setAttribute("role", "tab");
      const panel = panels[index];
      if (panel) {
        if (!panel.id) panel.id = `clone-tabs-panel-${Date.now()}-${index}`;
        if (!panel.getAttribute("role")) panel.setAttribute("role", "tabpanel");
        tab.setAttribute("aria-controls", panel.id);
        panel.setAttribute("aria-labelledby", tab.id);
      }
    });
  }

  function setActive(root, state, nextIndex) {
    const tabs = findTabs(root);
    const panels = findPanels(root);
    state.itemCount = Math.min(tabs.length, panels.length || tabs.length);
    state.activeIndex = clampIndex(nextIndex, state.itemCount || tabs.length);
    ensureA11y(root, tabs, panels);
    tabs.forEach((tab, index) => {
      const active = index === state.activeIndex;
      tab.setAttribute("aria-selected", active ? "true" : "false");
      tab.setAttribute("tabindex", active ? "0" : "-1");
      tab.classList.toggle("is-active", active);
    });
    panels.forEach((panel, index) => {
      const active = index === state.activeIndex;
      panel.toggleAttribute("hidden", !active);
      panel.setAttribute("aria-hidden", active ? "false" : "true");
      panel.classList.toggle("is-active", active);
    });
    root.setAttribute("data-tabs-active-index", String(state.activeIndex));
  }

  function readControls(root, controls) {
    const attrIndex = root.getAttribute("data-tabs-active-index");
    const defaultIndex = Number(controls?.defaultIndex ?? attrIndex ?? 0) || 0;
    return {
      defaultIndex,
      keyboardNavigation: controls?.keyboardNavigation !== false,
    };
  }

  function focusTab(root, state, nextIndex) {
    const tabs = findTabs(root);
    const index = clampIndex(nextIndex, tabs.length);
    setActive(root, state, index);
    if (tabs[index] && typeof tabs[index].focus === "function") tabs[index].focus();
  }

  function mount(root, options) {
    if (!root || instances.has(root)) return instances.get(root) || null;
    const state = {
      activeIndex: 0,
      itemCount: 0,
      controls: readControls(root, options?.controls || {}),
      cleanup: [],
    };
    const onClick = (event) => {
      const tab = event.target.closest("[data-tabs-tab]");
      if (!tab || !root.contains(tab)) return;
      event.preventDefault();
      const tabs = findTabs(root);
      const index = readIndexFromElement(tab, "data-tabs-tab", tabs.indexOf(tab));
      setActive(root, state, index);
    };
    root.addEventListener("click", onClick);
    state.cleanup.push(() => root.removeEventListener("click", onClick));

    if (state.controls.keyboardNavigation) {
      const onKeydown = (event) => {
        const tab = event.target.closest("[data-tabs-tab]");
        if (!tab || !root.contains(tab)) return;
        const tabs = findTabs(root);
        const current = tabs.indexOf(tab);
        if (current < 0) return;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          focusTab(root, state, current + 1 >= tabs.length ? 0 : current + 1);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          focusTab(root, state, current - 1 < 0 ? tabs.length - 1 : current - 1);
        } else if (event.key === "Home") {
          event.preventDefault();
          focusTab(root, state, 0);
        } else if (event.key === "End") {
          event.preventDefault();
          focusTab(root, state, tabs.length - 1);
        }
      };
      root.addEventListener("keydown", onKeydown);
      state.cleanup.push(() => root.removeEventListener("keydown", onKeydown));
    }

    setActive(root, state, state.controls.defaultIndex);
    instances.set(root, state);
    return state;
  }

  function update(root, options) {
    const state = instances.get(root) || mount(root, options);
    if (!state) return null;
    state.controls = readControls(root, options?.controls || state.controls || {});
    setActive(root, state, options?.activeIndex ?? state.controls.defaultIndex ?? state.activeIndex);
    return state;
  }

  function getState(root) {
    const state = instances.get(root);
    if (!state) return null;
    return {
      activeIndex: state.activeIndex,
      itemCount: state.itemCount,
    };
  }

  function verify(root) {
    const state = instances.get(root);
    const tabs = findTabs(root);
    const panels = findPanels(root);
    const activePanels = panels.filter((panel) => !panel.hasAttribute("hidden"));
    const selectedTabs = tabs.filter((tab) => tab.getAttribute("aria-selected") === "true");
    return {
      ok: Boolean(state && tabs.length && selectedTabs.length === 1 && (!panels.length || activePanels.length === 1)),
      activePanelVisible: !panels.length || activePanels.length === 1,
      tabAriaSync: selectedTabs.length === 1 && Number(root.getAttribute("data-tabs-active-index") || 0) === state?.activeIndex,
      destroyCleanup: true,
    };
  }

  function destroy(root) {
    const state = instances.get(root);
    if (!state) return;
    state.cleanup.forEach((fn) => fn());
    instances.delete(root);
  }

  const adapter = {
    interactionId: REGISTRY_KEY,
    mount,
    update,
    getState,
    verify,
    destroy,
  };

  window.CloneLLMInteractions = window.CloneLLMInteractions || {};
  window.CloneLLMInteractions[REGISTRY_KEY] = adapter;
})();
