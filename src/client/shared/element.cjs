/**
 * shared/element.cjs — the element factory the whole half builds markup with.
 *
 * `h` is React's own element factory, and every component in this half builds its
 * markup with it. The shell seeds `react` into the module loader, so requiring it
 * here costs nothing and needs no install; keeping the pragma in one place is what
 * lets a feature module be a plain file rather than a slice of the entry.
 */
const React = require('react')

/** `React.createElement`, under the name the whole half reads it by. */
const h = React.createElement

module.exports = { h }
