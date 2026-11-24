// Patches people can put on their clothes.
// To add one: put an SVG or PNG in this folder and add a line below, eg
//   { id: 'campus-wordmark', name: 'Campus wordmark', src: 'patches/campus-wordmark.svg' },
// `src` files must be on the same site as the tool (they are inlined for downloads).
// `svg` entries hold the markup directly. The two below are generic examples.
// Libraries can also supply their own list through the embed address: see the README.
window.PEEP_PATCHES = [
  {
    id: 'book', name: 'Open book',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" fill="#1F4E9C" stroke="#000" stroke-width="6"/><path d="M26 42c12-5 24-5 34 4v40c-10-8-22-8-34-3Z" fill="#fff" stroke="#000" stroke-width="5" stroke-linejoin="round"/><path d="M94 42c-12-5-24-5-34 4v40c10-8 22-8 34-3Z" fill="#fff" stroke="#000" stroke-width="5" stroke-linejoin="round"/></svg>'
  },
  {
    id: 'star', name: 'Star',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><path d="M60 8l15 33 36 4-27 24 8 35-32-18-32 18 8-35L9 45l36-4Z" fill="#F2C230" stroke="#000" stroke-width="6" stroke-linejoin="round"/></svg>'
  }
];
