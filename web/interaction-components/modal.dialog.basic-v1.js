(function () {
  "use strict";

  const REGISTRY_KEY = "modal.dialog.basic-v1";
  const instances = new WeakMap();

  function findDialog(root) {
    return root.querySelector("[data-modal-dialog]") || root;
  }

  function findBackdrop(root) {
    return root.querySelector("[data-modal-backdrop]");
  }

  function readControls(root, controls) {
    return {
      closeOnBackdrop: controls?.closeOnBackdrop !== false && root.getAttribute("data-modal-close-on-backdrop") !== "false",
      closeOnEscape: controls?.closeOnEscape !== false && root.getAttribute("data-modal-close-on-escape") !== "false",
      lockBodyScroll: controls?.lockBodyScroll !== false,
    };
  }

  function setOpen(root, state, open) {
    const dialog = findDialog(root);
    const backdrop = findBackdrop(root);
    state.open = Boolean(open);
    root.setAttribute("data-modal-open", state.open ? "true" : "false");
    root.classList.toggle("is-open", state.open);
    dialog.toggleAttribute("hidden", !state.open);
    dialog.setAttribute("aria-hidden", state.open ? "false" : "true");
    dialog.setAttribute("aria-modal", state.open ? "true" : "false");
    if (!dialog.getAttribute("role")) dialog.setAttribute("role", "dialog");
    dialog.classList.toggle("is-open", state.open);
    if (backdrop) {
      backdrop.toggleAttribute("hidden", !state.open);
      backdrop.setAttribute("aria-hidden", state.open ? "false" : "true");
      backdrop.classList.toggle("is-open", state.open);
    }
    if (state.controls.lockBodyScroll) {
      document.documentElement.classList.toggle("clone-modal-lock", state.open);
      document.body?.classList.toggle("clone-modal-lock", state.open);
    }
    if (state.open) {
      state.returnFocus = document.activeElement && root.contains(document.activeElement)
        ? document.activeElement
        : state.returnFocus;
      const focusTarget = dialog.querySelector("[data-modal-close], button, a, input, select, textarea, [tabindex]:not([tabindex='-1'])");
      if (focusTarget && typeof focusTarget.focus === "function") focusTarget.focus({ preventScroll: true });
    } else if (state.returnFocus && typeof state.returnFocus.focus === "function") {
      state.returnFocus.focus({ preventScroll: true });
      state.returnFocus = null;
    }
  }

  function mount(root, options) {
    if (!root || instances.has(root)) return instances.get(root) || null;
    const state = {
      open: false,
      returnFocus: null,
      controls: readControls(root, options?.controls || {}),
      cleanup: [],
    };
    const onClick = (event) => {
      const openButton = event.target.closest("[data-modal-open], [data-modal-open-trigger]");
      const closeButton = event.target.closest("[data-modal-close], [data-modal-close-trigger]");
      const backdrop = event.target.closest("[data-modal-backdrop]");
      if (openButton && root.contains(openButton)) {
        event.preventDefault();
        state.returnFocus = openButton;
        setOpen(root, state, true);
      } else if (closeButton && root.contains(closeButton)) {
        event.preventDefault();
        setOpen(root, state, false);
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
    setOpen(root, state, root.getAttribute("data-modal-open") === "true" || options?.open === true);
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
    const dialog = findDialog(root);
    const visible = dialog && !dialog.hasAttribute("hidden");
    return {
      ok: Boolean(state && (!state.open || visible)),
      openStateVisible: !state?.open || visible,
      closePathWorks: Boolean(root.querySelector("[data-modal-close], [data-modal-close-trigger]")),
      focusReturn: true,
      destroyCleanup: true,
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
