(function () {
  "use strict";

  const REGISTRY_KEY = "accordion.disclosure.basic-v1";
  const instances = new WeakMap();

  function toArray(value) {
    return Array.prototype.slice.call(value || []);
  }

  function findTriggers(root) {
    return toArray(root.querySelectorAll("[data-accordion-trigger]"));
  }

  function findPanels(root) {
    return toArray(root.querySelectorAll("[data-accordion-panel]"));
  }

  function normalizeIndexes(value, maxCount) {
    const source = Array.isArray(value)
      ? value
      : String(value || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
    return Array.from(new Set(source
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item >= 0 && item < maxCount)));
  }

  function readIndexFromElement(element, attrName, fallbackIndex) {
    const rawValue = element.getAttribute(attrName);
    const parsed = rawValue === "" || rawValue == null ? fallbackIndex : Number(rawValue);
    return Number.isFinite(parsed) ? parsed : fallbackIndex;
  }

  function ensureA11y(triggers, panels) {
    triggers.forEach((trigger, index) => {
      if (!trigger.id) trigger.id = `clone-accordion-trigger-${Date.now()}-${index}`;
      const panel = panels[index];
      if (!panel) return;
      if (!panel.id) panel.id = `clone-accordion-panel-${Date.now()}-${index}`;
      trigger.setAttribute("aria-controls", panel.id);
      panel.setAttribute("aria-labelledby", trigger.id);
    });
  }

  function setOpenIndexes(root, state, openIndexes) {
    const triggers = findTriggers(root);
    const panels = findPanels(root);
    const count = Math.min(triggers.length, panels.length || triggers.length);
    const normalized = normalizeIndexes(openIndexes, count);
    state.itemCount = count;
    state.openIndexes = state.controls.allowMultiple ? normalized : normalized.slice(0, 1);
    ensureA11y(triggers, panels);
    triggers.forEach((trigger, index) => {
      const open = state.openIndexes.includes(index);
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      trigger.classList.toggle("is-open", open);
    });
    panels.forEach((panel, index) => {
      const open = state.openIndexes.includes(index);
      panel.toggleAttribute("hidden", !open);
      panel.setAttribute("aria-hidden", open ? "false" : "true");
      panel.classList.toggle("is-open", open);
    });
    root.setAttribute("data-accordion-open-indexes", state.openIndexes.join(","));
  }

  function readControls(root, controls) {
    const attrOpen = root.getAttribute("data-accordion-default-open") || root.getAttribute("data-accordion-open-indexes");
    const allowMultipleAttr = root.getAttribute("data-accordion-allow-multiple");
    return {
      allowMultiple: controls?.allowMultiple === true || allowMultipleAttr === "true",
      defaultOpenIndexes: Array.isArray(controls?.defaultOpenIndexes)
        ? controls.defaultOpenIndexes
        : normalizeIndexes(attrOpen, 200),
    };
  }

  function toggleIndex(root, state, index) {
    const open = state.openIndexes.includes(index);
    if (state.controls.allowMultiple) {
      setOpenIndexes(root, state, open
        ? state.openIndexes.filter((item) => item !== index)
        : [...state.openIndexes, index]);
      return;
    }
    setOpenIndexes(root, state, open ? [] : [index]);
  }

  function focusTrigger(root, index) {
    const triggers = findTriggers(root);
    const max = triggers.length - 1;
    if (max < 0) return;
    const normalized = index < 0 ? max : index > max ? 0 : index;
    if (triggers[normalized] && typeof triggers[normalized].focus === "function") triggers[normalized].focus();
  }

  function mount(root, options) {
    if (!root || instances.has(root)) return instances.get(root) || null;
    const state = {
      openIndexes: [],
      itemCount: 0,
      controls: readControls(root, options?.controls || {}),
      cleanup: [],
    };
    const onClick = (event) => {
      const trigger = event.target.closest("[data-accordion-trigger]");
      if (!trigger || !root.contains(trigger)) return;
      event.preventDefault();
      const triggers = findTriggers(root);
      const index = readIndexFromElement(trigger, "data-accordion-trigger", triggers.indexOf(trigger));
      toggleIndex(root, state, index);
    };
    const onKeydown = (event) => {
      const trigger = event.target.closest("[data-accordion-trigger]");
      if (!trigger || !root.contains(trigger)) return;
      const triggers = findTriggers(root);
      const current = triggers.indexOf(trigger);
      if (current < 0) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusTrigger(root, current + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        focusTrigger(root, current - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        focusTrigger(root, 0);
      } else if (event.key === "End") {
        event.preventDefault();
        focusTrigger(root, triggers.length - 1);
      }
    };
    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKeydown);
    state.cleanup.push(() => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKeydown);
    });
    setOpenIndexes(root, state, state.controls.defaultOpenIndexes);
    instances.set(root, state);
    return state;
  }

  function update(root, options) {
    const state = instances.get(root) || mount(root, options);
    if (!state) return null;
    state.controls = readControls(root, options?.controls || state.controls || {});
    setOpenIndexes(root, state, options?.openIndexes ?? state.controls.defaultOpenIndexes ?? state.openIndexes);
    return state;
  }

  function getState(root) {
    const state = instances.get(root);
    if (!state) return null;
    return {
      openIndexes: [...state.openIndexes],
      itemCount: state.itemCount,
    };
  }

  function verify(root) {
    const state = instances.get(root);
    const triggers = findTriggers(root);
    const panels = findPanels(root);
    const ariaExpandedSync = triggers.every((trigger, index) => {
      const open = state?.openIndexes.includes(index) || false;
      return trigger.getAttribute("aria-expanded") === (open ? "true" : "false");
    });
    const openedPanelVisible = state?.openIndexes.every((index) => panels[index] && !panels[index].hasAttribute("hidden")) || false;
    return {
      ok: Boolean(state && triggers.length && ariaExpandedSync),
      openedPanelVisible: state?.openIndexes.length ? openedPanelVisible : true,
      ariaExpandedSync,
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
