# Webflow JavaScript Snippet Notes

These notes summarize the patterns that make small JavaScript snippets work well inside Webflow projects.

## Core Philosophy

Webflow-focused scripts should enhance designer-built markup instead of replacing it. The HTML and CSS created in Webflow should remain the source of truth, while JavaScript adds behavior by reading stable attributes, CSS variables, and local component structure.

Good snippets are:

- Attribute-driven
- Safe to run on pages where the feature does not exist
- Safe to run more than once
- Scoped to each component instance
- Tolerant of Webflow CMS wrapper markup
- Friendly to async script loading
- Easy to reinitialize after dynamic content changes

## Use Data Attributes as the Public API

Prefer attributes such as:

```html
data-slider="component"
data-slider="slider"
data-slider="next"
data-slider="previous"
data-slider="pagination"
data-tabs="component"
```

This lets designers wire behavior in Webflow without editing JavaScript. It also avoids brittle dependencies on generated class names or deeply nested DOM selectors.

## Scope Behavior to Component Instances

When a snippet supports repeated components, find controls from the nearest component wrapper instead of using document-wide selectors.

```js
const component = element.closest('[data-slider="component"]');
const next = component.querySelector('[data-slider="next"]');
```

This prevents one component instance from accidentally controlling another.

Always guard missing wrappers or controls. A page should not break because one optional element is absent.

## Let CSS Control Layout

Use CSS variables for values that designers may want to change in Webflow:

```css
--xs: 1;
--sm: 1.25;
--md: 2;
--lg: 3;
--gap: 24;
```

Then read them from JavaScript:

```js
const computedStyle = getComputedStyle(element);
const lg = parseFloat(computedStyle.getPropertyValue("--lg")) || 3;
```

This keeps responsive design decisions in Webflow/CSS and avoids hardcoding layout behavior in JavaScript.

## Wait for Dependencies

Avoid exiting permanently just because a global dependency is not available at the exact moment the snippet runs.

For Webflow custom code, CDN scripts and page scripts may load in different orders. Prefer a small readiness helper that waits for both the DOM and the dependency:

```js
function whenReady(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
  } else {
    callback();
  }
}
```

If the snippet depends on a global such as `window.Swiper`, poll briefly and fail quietly if it never appears.

## Make Initialization Idempotent

A snippet should be safe to call repeatedly.

Before creating a new instance, check whether one already exists:

```js
if (element.swiperInstance && !element.swiperInstance.destroyed) {
  element.swiperInstance.update();
  return;
}
```

This matters when scripts are re-run after CMS updates, tabs reveal hidden content, layout changes, or external code calls a public `init()` method.

## Expose a Small Public API

For snippets that may need external control, expose a namespaced global:

```js
window.AttributesSlider = {
  init: function () {},
  reinitialize: function () {},
  getInstance: function (index) {},
};
```

Keep the API small. Useful methods are usually:

- `init()`
- `reinitialize()`
- `getInstance(index)`

## Handle Webflow CMS Markup

CMS Collection Lists often introduce wrappers such as:

```html
.w-dyn-list
.w-dyn-items
.w-dyn-item
```

If a library expects a specific structure, the snippet may need to unwrap these elements. Be careful not to unwrap elements that are also part of the library structure, such as `.swiper-wrapper` or `.swiper-slide`.

## Account for Images and Dynamic Height

Webflow pages often include responsive images, CMS content, and late layout shifts.

For layout-sensitive snippets:

- Recalculate after images load
- Use `requestAnimationFrame` for layout reads/writes
- Use `ResizeObserver` when available
- Clean up observers and pending frames when destroying instances

## Reinitialize on Real Viewport Changes

Mobile browsers can fire resize events when the address bar changes height. If the snippet only needs to respond to layout breakpoint changes, compare `window.innerWidth` and ignore height-only changes.

Debounce resize work:

```js
let resizeTimeout;
let lastWidth = window.innerWidth;

function handleResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const currentWidth = window.innerWidth;
    if (currentWidth !== lastWidth) {
      lastWidth = currentWidth;
      window.AttributesSlider.reinitialize();
    }
  }, 250);
}
```

## Fail Quietly, But Log Useful Errors

Snippets should not break the whole page if one component is misconfigured.

Wrap component initialization in `try/catch`, and log a concise error for debugging:

```js
try {
  initializeComponent(element);
} catch (error) {
  if (typeof console !== "undefined" && console.error) {
    console.error("Component initialization failed:", error);
  }
}
```

## Quick Checklist

- Use an IIFE and `"use strict"`.
- Define selectors as constants.
- Use `window.DependencyName` for globals.
- Wait for DOM readiness.
- Wait briefly for required third-party globals.
- Query by data attributes, not brittle class paths.
- Scope controls to the nearest component wrapper.
- Guard missing optional elements.
- Store instances on the element.
- Destroy before reinitializing.
- Avoid duplicate event listeners.
- Read designer-controlled values from CSS variables.
- Handle CMS wrapper markup carefully.
- Recalculate layout after images and content changes.
- Expose only the public methods future custom code needs.
