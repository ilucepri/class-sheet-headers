# Class Sheet Headers

Foundry VTT module for the dnd5e system. It changes the header image of character sheets:

- **Per class**: the GM picks an image for each class (found in the world, on actors and in the Item compendiums).
- **General images**: one for player characters (owned by a player) and one for the rest, used when no class image applies.
- **Per character**: from the sheet's header menu (*Sheet header*), the GM or the owner can give a character its own image.
- **Campaign image**: one image for every character, handy for themed campaigns. By default it is the last fallback; tick *Force for everyone* to show it on every sheet, over class and character images.
- **Use the basic header**: a button at the bottom of the config window turns every custom header off and shows the dnd5e default, without deleting any image. Press it again to bring them back.
- **Framing editor**: drag the preview to move the image, and zoom in or out with the mouse wheel or the slider, so you only show the part of the image you want.

Priority: forced campaign image → the character's own image → its class image → the general image → the campaign image → the dnd5e default.

Settings (*Configure Settings → Class Sheet Headers*):

- **Configure headers**: the class and general images.
- **Multiclass header**: use the original class or the highest-level class.
- **Class images for player characters only**.
- **Players can choose their header**.

The preview has the shape of the default header (1391 × 510). Offsets are stored as a share of the header, so the framing stays the same if the sheet is resized, though a much wider sheet shows a little more or less of the image.

## Install

In Foundry, go to *Add-on Modules → Install Module* and paste this manifest URL:

```
https://github.com/ilucepri/class-sheet-headers/releases/latest/download/module.json
```

Compatibility: Foundry v13–v14, dnd5e 5.x (tested against 5.3.3).
