# Peeps maker

An Open Peeps avatar builder any library can embed in a LibGuide, a learning management system course or its own site. Visitors pick an outfit, skin tone, hair and hair color, face, facial hair, glasses, a mask and a backdrop across three views (head and shoulders, standing, sitting), add patches to their clothes, and download the result as SVG or PNG in three sizes. Clicking any part of the avatar opens its controls: a garment's color, the hair, face or glasses tab, or a patch's size, tilt and placement handles. Their avatar saves in their browser, and "Save to desktop" or "Copy link" brings it back on any computer. Everything runs in the browser: no accounts, no tracking, no build step.

Live tool: <https://chilburger.github.io/peeps-maker/>

## Embedding it

Paste this into a LibGuide **Media/Widget** asset (Add/Reorder → Media/Widget) or any web page:

```html
<iframe src="https://chilburger.github.io/peeps-maker/" title="Avatar maker"
  loading="lazy" allow="clipboard-write" style="width:100%;max-width:960px;height:1000px;border:1px solid #ccc;border-radius:8px"></iframe>
```

To hide the tool behind a button, paste this instead:

```html
<button id="peeps-btn" type="button" aria-expanded="false" aria-controls="peeps-frame-wrap"
  style="background:#1f4e9c;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-size:16px;cursor:pointer">
  Make your avatar
</button>
<div id="peeps-frame-wrap" hidden style="margin-top:12px">
  <iframe src="https://chilburger.github.io/peeps-maker/" title="Avatar maker"
    loading="lazy" allow="clipboard-write" style="width:100%;max-width:960px;height:1000px;border:1px solid #ccc;border-radius:8px"></iframe>
</div>
<script>
  (function () {
    var btn = document.getElementById('peeps-btn'), wrap = document.getElementById('peeps-frame-wrap');
    btn.addEventListener('click', function () {
      var open = wrap.hidden; wrap.hidden = !open; btn.setAttribute('aria-expanded', open);
    });
    if (location.hash === '#' + btn.id) { wrap.hidden = false; btn.setAttribute('aria-expanded', 'true'); }
  })();
</script>
```

Linking to the page with `#peeps-btn` on the end opens the tool straight away. Rename the `id` to match an existing link if you need to.

## Adding your campus branding

Add options to the end of the `src` address. No copy of the code is needed.

| Option | What it does | Example |
|---|---|---|
| `accent` | Color of buttons and the default top, as a six-digit hex code | `accent=7a1f5c` |
| `bg` | Default avatar background | `bg=f6eaf1` |
| `patches` | Address of your own patch list, which replaces the standard patches | `patches=https://example.edu/peeps/patches.json` |

Combine them with `&`:

```html
<iframe src="https://chilburger.github.io/peeps-maker/?accent=7a1f5c&bg=f6eaf1&patches=https://example.edu/peeps/patches.json" …></iframe>
```

### Your own patch list

A patch list is a small JSON file next to your images:

```json
{
  "patches": [
    { "id": "wordmark", "name": "Campus wordmark", "src": "wordmark.svg" },
    { "id": "mascot", "name": "Mascot", "src": "mascot.png" }
  ]
}
```

- `src` can be a full address or a path relative to the list.
- Add `"tilt": false` to keep a logo upright. Many brand guidelines forbid angling the logo; with this set, the tool hides the tilt controls for that patch.
- Add `"scale"` to start a patch bigger or smaller than a chest badge (eg `2.5` for lettering across the chest; 0.3–4), and `"center": true` to start it in the middle of the chest instead of on the left.
- Use SVG, PNG, WebP, GIF or JPEG. SVG or a PNG with a transparent background looks best on clothes. In SVG files, convert text to outlines so it looks the same everywhere.
- The list and images must be served over `https` from a host that allows cross-site requests (an `Access-Control-Allow-Origin` header). GitHub Pages does this by default, so a free repository is the simplest place to host them. If the list can't be loaded, the tool shows the standard patches and says so.
- [`examples/patches.json`](examples/patches.json) is a working example, and [`campuses/fredonia/patches.json`](campuses/fredonia/patches.json) is a real one.
- Use only logos and marks your institution allows. Check with your marketing or communications office.

### Forking instead

To change anything else, fork this repository, edit `patches/patches.js` (and anything else) and publish your copy with GitHub Pages.

## Checking and fixing layers

Open the tool with `?admin=1` on the end of the address. A layer checker appears under the controls. Visitors never see it.

- **Check:** choose hair, faces, facial hair, glasses, masks, head-on-outfit (for the current view) or default patch spot.
- **Show all:** draws every item in that category on your current avatar, so broken ones stand out. Click one to open it.
- **Nudge:** arrow keys move the selected item (Shift for steps of 10), `+`/`-` resize it, `,`/`.` tilt a head, `[`/`]` step through items, `K` marks an item checked and moves to the next one.
- **Hide from visitors:** removes an item from the pickers without deleting it.
- **Doesn't work with:** records a clash between the item and something selected in another category, or with anything in that category ("any"). Visitors then can't combine them: an optional part (facial hair, glasses, mask) is removed automatically, and an option that clashes with the outfit, hair or face is greyed out.
- **Save:** changes are kept in your browser as you work. Click **Download layers.js** and replace `config/layers.js` in the repository to publish them.

## Files

- `index.html`, `app.js`: the tool
- `parts/parts.js`: every Open Peeps part as plain SVG, generated by `tools/extract-parts.mjs`
- `parts/extra-bodies.js`: three outfits the npm packages leave out (Tee 2, Device, Sweater), generated by `tools/extract-bloom-bodies.mjs`
- `config/layers.js`: positions, hidden items, clash rules, each outfit's garment names and colorable areas (`garments`), and where each hairstyle's hair is (`hairGeometry`, used to place the second and third hair colors)
- `patches/patches.js`: the standard patches
- `examples/`: a sample patch list for the `patches` option

## Rebuilding the parts

```bash
npm pack @opeepsfun/open-peeps @dicebear/open-peeps
```

Unpack both, then run:

```bash
node tools/extract-parts.mjs <opeepsfun package dir> <dicebear package dir> > parts/parts.js
```

The script reads the package files as text and never runs their code.

## Measuring the hair

The hair-color patterns (streaks, highlights, ombré, tips and split) are placed from each hairstyle's measured hair: its box, the part, and the forehead hairline. After the hair parts change, measure any new styles (needs Playwright):

```bash
node tools/measure-hair.mjs
```

Styles already in `hairGeometry` keep their numbers, so hand corrections survive; add `--all` to remeasure every style. A style can also set `"tips": "up"` (frosted tips on top) or `"tips": "down"` (colored ends at the bottom) when the automatic choice looks wrong.

The three extra outfits come from the Open Peeps "Flat Assets" download, with skin and clothing already separated:

```bash
node tools/extract-bloom-bodies.mjs <path to openpeeps-parts.json> > parts/extra-bodies.js
```

## Credits and licenses

- Illustrations: [Open Peeps](https://www.openpeeps.com/) by Pablo Stanley, CC0 1.0 (public domain).
- Part data adapted from [@opeepsfun/open-peeps](https://www.npmjs.com/package/@opeepsfun/open-peeps) (bodies, hair, faces, facial hair, glasses and their offsets) and [@dicebear/open-peeps](https://www.npmjs.com/package/@dicebear/open-peeps) (masks), both MIT for code and CC0 for art.
- Tool: © 2026 Christina Hilburger, [CC BY 4.0](LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Avatars people make are theirs to use however they like, with no credit required.
- Logos and marks a library adds as patches belong to their owners and are not covered by CC BY 4.0. SUNY Fredonia's are in [`campuses/fredonia/`](campuses/fredonia/NOTICE.md).
