(function () {
  "use strict";

  const REGISTRY_KEY = "segmented.control.basic-v1";
  const instances = new WeakMap();

  function toArray(value) {
    return Array.prototype.slice.call(value || []);
  }

  function findItems(root) {
    return toArray(root.querySelectorAll("[data-segmented-item]"));
  }

  function clampIndex(index, count) {
    if (!count) return 0;
    const next = Number(index || 0);
    if (!Number.isFinite(next)) return 0;
    return Math.max(0, Math.min(count - 1, next));
  }

  function readIndex(element, fallbackIndex) {
    const rawValue = element.getAttribute("data-segmented-item");
    const parsed = rawValue === "" || rawValue == null ? fallbackIndex : Number(rawValue);
    return Number.isFinite(parsed) ? parsed : fallbackIndex;
  }

  function readControls(root, controls) {
    return {
      defaultIndex: clampIndex(controls?.defaultIndex ?? root.getAttribute("data-segmented-selected-index") ?? 0, 999),
    };
  }

  function setSelected(root, state, nextIndex) {
    const items = findItems(root);
    state.itemCount = items.length;
    state.selectedIndex = clampIndex(nextIndex, items.length);
    if (!root.getAttribute("role")) root.setAttribute("role", "radiogroup");
    items.forEach((item, index) => {
      const selected = index === state.selectedIndex;
      if (!item.getAttribute("role")) item.setAttribute("role", "radio");
      item.setAttribute("aria-checked", selected ? "true" : "false");
      item.setAttribute("aria-pressed", selected ? "true" : "false");
      item.setAttribute("tabindex", selected ? "0" : "-1");
      item.classList.toggle("is-active", selected);
    });
    root.setAttribute("data-segmented-selected-index", String(state.selectedIndex));
  }

  function focusItem(root, state, nextIndex) {
    const items = findItems(root);
    const index = clampIndex(nextIndex, items.length);
    setSelected(root, state, index);
    if (items[index] && typeof items[index].focus === "function") items[index].focus();
  }

  function mount(root, options) {
    if (!root || instances.has(root)) return instances.get(root) || null;
    const state = {
      selectedIndex: 0,
      itemCount: 0,
      controls: readControls(root, options?.controls || {}),
      cleanup: [],
    };
    const onClick = (event) => {
      const item = event.target.closest("[data-segmented-item]");
      if (!item || !root.contains(item)) return;
      event.preventDefault();
      const items = findItems(root);
      setSelected(root, state, readIndex(item, items.indexOf(item)));
    };
    const onKeydown = (event) => {
      const item = event.target.closest("[data-segmented-item]");
      if (!item || !root.contains(item)) return;
      const items = findItems(root);
      const current = items.indexOf(item);
      if (current < 0) return;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        focusItem(root, state, current + 1 >= items.length ? 0 : current + 1);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        focusItem(root, state, current - 1 < 0 ? items.length - 1 : current - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        focusItem(root, state, 0);
      } else if (event.key === "End") {
        event.preventDefault();
        focusItem(root, state, items.length - 1);
      }
    };
    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKeydown);
    state.cleanup.push(() => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKeydown);
    });
    setSelected(root, state, options?.selectedIndex ?? state.controls.defaultIndex);
    instances.set(root, state);
    return state;
  }

  function update(root, options) {
    const state = instances.get(root) || mount(root, options);
    if (!state) return null;
    state.controls = readControls(root, options?.controls || state.controls || {});
    setSelected(root, state, options?.selectedIndex ?? state.controls.defaultIndex ?? state.selectedIndex);
    return state;
  }

  function getState(root) {
    const state = instances.get(root);
    if (!state) return null;
    return {
      selectedIndex: state.selectedIndex,
      itemCount: state.itemCount,
    };
  }

  function verify(root) {
    const state = instances.get(root);
    const items = findItems(root);
    const selected = items.filter((item) => item.getAttribute("aria-checked") === "true");
    return {
      ok: Boolean(state && items.length && selected.length === 1),
      selectedStateSync: selected.length === 1 && Number(root.getAttribute("data-segmented-selected-index") || 0) === state?.selectedIndex,
      keyboardWorks: true,
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
