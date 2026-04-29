(function () {
  "use strict";

  const REGISTRY_KEY = "compare.slider.basic-v1";
  const instances = new WeakMap();

  function clamp(value, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return min;
    return Math.max(min, Math.min(max, parsed));
  }

  function findRange(root) {
    return root.querySelector("[data-compare-range]");
  }

  function findHandle(root) {
    return root.querySelector("[data-compare-handle]");
  }

  function findAfterLayer(root) {
    return root.querySelector("[data-compare-after]");
  }

  function readControls(root, controls) {
    return {
      defaultPosition: clamp(controls?.defaultPosition ?? root.getAttribute("data-compare-position") ?? 50, 0, 100),
      keyboardStep: clamp(controls?.keyboardStep ?? root.getAttribute("data-compare-keyboard-step") ?? 5, 1, 50),
    };
  }

  function setPosition(root, state, position) {
    const next = clamp(position, 0, 100);
    const range = findRange(root);
    const handle = findHandle(root);
    const afterLayer = findAfterLayer(root);
    state.position = next;
    root.setAttribute("data-compare-position", String(next));
    root.style.setProperty("--compare-position", `${next}%`);
    if (range) {
      range.value = String(next);
      range.setAttribute("aria-valuenow", String(next));
    }
    if (handle) {
      handle.style.left = `${next}%`;
      handle.setAttribute("aria-valuenow", String(next));
      if (!handle.getAttribute("role")) handle.setAttribute("role", "slider");
      handle.setAttribute("aria-valuemin", "0");
      handle.setAttribute("aria-valuemax", "100");
      handle.setAttribute("tabindex", "0");
    }
    if (afterLayer) afterLayer.style.clipPath = `inset(0 ${100 - next}% 0 0)`;
  }

  function positionFromPointer(root, event) {
    const rect = root.getBoundingClientRect();
    if (!rect.width) return 50;
    return ((event.clientX - rect.left) / rect.width) * 100;
  }

  function mount(root, options) {
    if (!root || instances.has(root)) return instances.get(root) || null;
    const state = {
      position: 50,
      dragging: false,
      controls: readControls(root, options?.controls || {}),
      cleanup: [],
    };
    const onInput = (event) => {
      const range = event.target.closest("[data-compare-range]");
      if (!range || !root.contains(range)) return;
      setPosition(root, state, range.value);
    };
    const onPointerdown = (event) => {
      const target = event.target.closest("[data-compare-handle], [data-compare-track]");
      if (!target || !root.contains(target)) return;
      event.preventDefault();
      state.dragging = true;
      setPosition(root, state, positionFromPointer(root, event));
      if (typeof target.setPointerCapture === "function") target.setPointerCapture(event.pointerId);
    };
    const onPointermove = (event) => {
      if (!state.dragging) return;
      event.preventDefault();
      setPosition(root, state, positionFromPointer(root, event));
    };
    const onPointerup = () => {
      state.dragging = false;
    };
    const onKeydown = (event) => {
      const handle = event.target.closest("[data-compare-handle]");
      if (!handle || !root.contains(handle)) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        event.preventDefault();
        setPosition(root, state, state.position - state.controls.keyboardStep);
      } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        event.preventDefault();
        setPosition(root, state, state.position + state.controls.keyboardStep);
      } else if (event.key === "Home") {
        event.preventDefault();
        setPosition(root, state, 0);
      } else if (event.key === "End") {
        event.preventDefault();
        setPosition(root, state, 100);
      }
    };
    root.addEventListener("input", onInput);
    root.addEventListener("pointerdown", onPointerdown);
    root.addEventListener("pointermove", onPointermove);
    root.addEventListener("pointerup", onPointerup);
    root.addEventListener("keydown", onKeydown);
    state.cleanup.push(() => {
      root.removeEventListener("input", onInput);
      root.removeEventListener("pointerdown", onPointerdown);
      root.removeEventListener("pointermove", onPointermove);
      root.removeEventListener("pointerup", onPointerup);
      root.removeEventListener("keydown", onKeydown);
    });
    setPosition(root, state, options?.position ?? state.controls.defaultPosition);
    instances.set(root, state);
    return state;
  }

  function update(root, options) {
    const state = instances.get(root) || mount(root, options);
    if (!state) return null;
    state.controls = readControls(root, options?.controls || state.controls || {});
    if (Object.prototype.hasOwnProperty.call(options || {}, "position")) setPosition(root, state, options.position);
    return state;
  }

  function getState(root) {
    const state = instances.get(root);
    if (!state) return null;
    return { position: state.position };
  }

  function verify(root) {
    const state = instances.get(root);
    const rootPosition = root.getAttribute("data-compare-position");
    return {
      ok: Boolean(state && rootPosition === String(state.position)),
      positionSync: rootPosition === String(state?.position),
      keyboardWorks: Boolean(root.querySelector("[data-compare-handle], [data-compare-range]")),
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
