---
title: "Event-Driven Programming: Practice"
subtitle: SI 379
author: Steve Oney
date: September 1, 2026
---

## Warm-up

**Q1.** In one or two sentences, explain the difference between `addEventListener`
and assigning to an element's `onclick` property.

::: answer
`addEventListener` can attach *multiple* handlers to the same event and lets you
control capture/bubble phase; `onclick` holds a single handler, so a second
assignment silently replaces the first.
:::

**Q2.** What does the following code print when the button is clicked **twice**?

```js
let count = 0;
const btn = document.querySelector('#inc');
btn.addEventListener('click', () => {
    count += 1;
    console.log(`clicked ${count} time(s)`);
});
```

::: answer 2
`clicked 1 time(s)` then `clicked 2 time(s)` — `count` is captured by reference
in the closure, so it persists across calls.
:::

## Short answer

**Q3.** Sketch (in code or pseudocode) how you would debounce a `resize`
handler so it runs at most once every 250ms.

::: answer 2.5in
```js
let timeout = null;
window.addEventListener('resize', () => {
    clearTimeout(timeout);
    timeout = setTimeout(doLayout, 250);
});
```
:::

**Q4.** The running time of binary search satisfies
$T(n) = T(n/2) + O(1)$. Solve the recurrence and give the tight bound.

::: answer 3
$T(n) = O(\log n)$ — each step halves the input, so after $k$ steps we have
$n/2^k = 1$, giving $k = \log_2 n$.
:::

> Reminder: exam 1 covers everything through this worksheet. See the
> [course site](https://soney.github.io) for practice materials.
