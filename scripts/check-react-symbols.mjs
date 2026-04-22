import React from 'react';
import { jsx } from 'react/jsx-runtime';

const el1 = React.createElement('div', null, 'test');
const el2 = jsx('div', { children: 'test' });

const REACT_ELEMENT = Symbol.for('react.element');
const REACT_TRANSITIONAL = Symbol.for('react.transitional.element');

console.log('React version:', React.version);
console.log('');
console.log('createElement:');
console.log('  $$typeof description:', el1['$$typeof'].description);
console.log('  matches react.element:', el1['$$typeof'] === REACT_ELEMENT);
console.log('  matches react.transitional.element:', el1['$$typeof'] === REACT_TRANSITIONAL);
console.log('');
console.log('jsx():');
console.log('  $$typeof description:', el2['$$typeof'].description);
console.log('  matches react.element:', el2['$$typeof'] === REACT_ELEMENT);
console.log('  matches react.transitional.element:', el2['$$typeof'] === REACT_TRANSITIONAL);
