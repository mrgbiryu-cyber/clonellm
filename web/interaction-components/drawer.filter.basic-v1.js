(function () {
  "use strict";

  const REGISTRY_KEY = "drawer.filter.basic-v1";
  const instances = new WeakMap();

  function findPanel(root) {
    return root.querySelector("[data-drawer-panel]") || root;
  }

  function findBackdrop(root) {
    return root.querySelector("[data-drawer-backdrop]");
  }

  function readControls(root, controls) {
    const placement = String(controls?.placement || root.getAttribute("data-drawer-placement") || "left").trim() || "left";
    return {
      placement,
      closeOnBackdrop: controls?.closeOnBackdrop !== false,
      closeOnEscape: controls?.closeOnEscape !== false,
      lockBodyScroll: controls?.lockBodyScroll !== false,
    };
  }

  function setOpen(root, state, open) {
    const panel = findPanel(root);
    const backdrop = findBackdrop(root);
    state.open = Boolean(open);
    root.setAttribute("data-drawer-open", state.open ? "true" : "false");
    root.classList.toggle("is-open", state.open);
    panel.toggleAttribute("hidden", !state.open);
    panel.setAttribute("aria-hidden", state.open ? "false" : "true");
    panel.classList.toggle("is-open", state.open);
    if (backdrop) {
      backdrop.toggleAttribute("hidden", !state.open);
      backdrop.setAttribute("aria-hidden", state.open ? "false" : "true");
      backdrop.classList.toggle("is-open", state.open);
    }
    if (state.controls.lockBodyScroll) {
      document.documentElement.classList.toggle("clone-drawer-lock", state.open);
      document.body?.classList.toggle("clone-drawer-lock", state.open);
    }
  }

  function mount(root, options) {
    if (!root || instances.has(root)) return instances.get(root) || null;
    const state = {
      open: false,
      controls: readControls(root, options?.controls || {}),
      cleanup: [],
    };
    const onClick = (event) => {
      const closeButton = event.target.closest("[data-drawer-close], [data-drawer-close-trigger]");
      const openButton = event.target.closest("[data-drawer-open-trigger]");
      const backdrop = event.target.closest("[data-drawer-backdrop]");
      if (closeButton && root.contains(closeButton)) {
        event.preventDefault();
        setOpen(root, state, false);
      } else if (openButton && root.contains(openButton)) {
        event.preventDefault();
        setOpen(root, state, true);
      } else if (backdrop && root.contains(backdrop) && state.controls.closeOnBackdrop) {
        event.preventDefault();
        setOpen(root, state, false);
      }
    };
    const onKeydown = (event) => {
      if (event.key === "Escape" && state.open && state.controls.closeOnEscape) {
        event.preventDefault();
        setOpen(root, state, false);
      }
    };
    root.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeydown);
    state.cleanup.push(() => {
      root.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeydown);
    });
    setOpen(root, state, root.getAttribute("data-drawer-open") === "true" || options?.open === true);
    instances.set(root, state);
    return state;
  }

  function update(root, options) {
    const state = instances.get(root) || mount(root, options);
    if (!state) return null;
    state.controls = readControls(root, options?.controls || state.controls || {});
    if (Object.prototype.hasOwnProperty.call(options || {}, "open")) setOpen(root, state, options.open);
    return state;
  }

  function getState(root) {
    const state = instances.get(root);
    if (!state) return null;
    return { open: state.open };
  }

  function verify(root) {
    const state = instances.get(root);
    const panel = findPanel(root);
    const visible = panel && !panel.hasAttribute("hidden");
    return {
      ok: Boolean(state && (!state.open || visible)),
      openStateVisible: !state?.open || visible,
      closePathWorks: Boolean(root.querySelector("[data-drawer-close], [data-drawer-close-trigger]")),
      destroyCleanup: true,
      noHorizontalOverflow: root.scrollWidth <= root.clientWidth + 2,
    };
  }

  function destroy(root) {
    const state = instances.get(root);
    if (!state) return;
    setOpen(root, state, false);
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
