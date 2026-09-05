# Demo photographs

Images dropped in this folder become the demo members' profile photos the next
time `npm run demo:seed` runs. Without them, each member gets a generated
gradient with their initial, which exercises the layouts but looks like nothing.

The images themselves are git-ignored. Only this file is tracked, so nobody
inherits a folder of pictures with a clone and nothing large lands in the
repository.

## One rule

**Never put a photograph of a real person in here.** A stock face on a
fabricated profile is somebody's likeness being used to imply they are looking
for a relationship, which is not a thing to do casually even in development.
AI-generated portraits depict nobody, which is the point. Screenshots of these
profiles also end up in specs, decks and bug reports, where a real face would
travel further than anyone intended.

## Naming

Three per member, so the profile's photo strip and its "1 of 3" affordance have
something to work with:

```
debashish-1.jpg   debashish-2.jpg   debashish-3.jpg
```

`.jpg`, `.jpeg`, `.png` and `.webp` are all accepted. A bare `debashish.jpg` is
taken as the first photo, and the remaining two fall back to gradients — one
good portrait is enough to get started. Members with no file at all keep the
gradients, and the seed output says which is which.

Portrait orientation, roughly 4:5. The cards crop to fill, so a landscape image
loses the top and bottom of the face.

## Who to generate

The cast is defined in `scripts/demo-seed.mjs`. Ages are as of 2026.

| File prefix | Who |
| --- | --- |
| `meera` | Woman, 44, Pune. Teaches mathematics. Divorced. |
| `arun` | Man, 51, Bengaluru. Divorced. |
| `priya` | Woman, 38, Kolkata. Divorced. |
| `rakesh` | Man, 47, Thiruvananthapuram. Divorced. |
| `farida` | Woman, 56, Hyderabad. Divorced. |
| `vikram` | Man, 48, Pune. Divorced. |
| `anjali` | Woman, 41, Mumbai. Divorced. |
| `sanjay` | Man, 36, Delhi. Divorced, writes software. |
| `debashish` | Man, 46, Kolkata. Restores old radios. Separated. |
| `imran` | Man, 40, Kolkata. Teaches history, cooks a great deal. Divorced. |
| `nikhil` | Man, 52, Bengaluru. Widowed, walks the city. |
| `ritu` | Woman, 43, Kolkata. Runs a design studio. Separated. |

## The quick route: one sheet, then slice it

Thirty-six portraits is thirty-six prompts and thirty-six downloads. Ask for a
single labelled contact sheet instead — paste this whole file into ChatGPT and
ask for one image containing all twelve people, three shots each, with the
handle written above each block. That is close to what these tools produce by
default, and it is how the current set was made.

Then cut it up:

```
node scripts/slice-contact-sheet.mjs "C:/path/to/sheet.png" --dry-run
node scripts/slice-contact-sheet.mjs "C:/path/to/sheet.png"
npm run demo:seed
```

The slicer finds the grid by looking for the white gutters rather than assuming
fixed coordinates, so a sheet laid out slightly differently still works. Run
`--dry-run` first: it prints which cell becomes which file, and getting that
mapping wrong puts somebody else's face on a profile. If the sheet's reading
order differs, reorder `LEFT` and `RIGHT` in the script rather than adjusting the
crops.

The catch is resolution. A cell on a twelve-person sheet is only a couple of
hundred pixels across, so the results are soft on a full-screen card. Good enough
to judge the layout; if you want one person to look genuinely good, generate that
portrait on its own and drop it in as `<handle>-1.jpg` — it takes precedence and
nothing else has to change.

## A prompt that produces the right thing

Eraya's members are Indian, mostly in their forties and fifties, and the product
is calm rather than glamorous. Portraits that look like a fashion shoot make the
whole app read as a different product, so ask for something plainer than an image
tool will give you by default:

> A natural, candid portrait photograph of a 46-year-old Indian man in Kolkata.
> Warm daylight, soft background, plain everyday clothes. He looks relaxed and
> approachable, a slight smile, looking towards the camera. Photographic and
> unretouched — visible skin texture, some grey in the hair, ordinary rather than
> glamorous. Vertical 4:5 framing, head and shoulders.

Swap the age, gender and city per row above. For the second and third image of
the same person, ask for the same face in a different setting — outdoors, at
home, at whatever they do — rather than a fresh generation, or the strip reads as
three different people.

Avoid: studio lighting, business headshots, heavy retouching, anyone who looks
under thirty, and the same background for everybody.
