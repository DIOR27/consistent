# Consistent Icons

Consistent Icons is a GNOME Shell 49 extension that gives application icons a more uniform shape in the app grid, folder previews, search results, and compatible docks. It uses each icon supplied by GNOME or the active icon theme; it does not replace the system icon theme or change icons inside application windows.

Maintained by **DIOR27**.

## Appearance

The extension inspects the effective image used for an icon, including icons resolved from the currently active icon theme, then classifies its visible silhouette:

- Rounded-square icons are left unchanged.
- Square icons with sharp corners keep their original artwork and receive rounded corners.
- Other shapes are placed on a rounded tile, with the artwork centered and scaled proportionally to 70% of the tile size.

Shape detection uses the image's visible pixel bounds, transparency, and sampled edges and corners. It is a visual heuristic, so unusual artwork can be classified imperfectly. When an icon cannot be inspected, the extension uses the rounded-tile treatment as a fallback.

Generated tiles use light or dark colors to match GNOME's appearance setting. A subtle highlight and shadow add depth. The tile colors update when the system appearance changes, and icon analysis is refreshed when the active icon theme changes.

## Compatibility

The extension supports GNOME Shell 48, 49, and 50 from one package. It styles application icons created through GNOME Shell's shared app-icon API and refreshes existing actors it can identify. This also covers docks that use that API or expose an application and its icon actor to GNOME Shell. A third-party dock with a separate icon-rendering implementation may need its own integration.

## Install

Install the packaged extension from this directory:

```sh
gnome-extensions install consistent-icons@dior27.dev.shell-extension.zip
```

Then enable **Consistent Icons** in the Extensions app. If GNOME Shell does not discover it immediately, sign out and back in.

To package the current source, compile its settings schema and include both the XML and compiled form:

```sh
glib-compile-schemas --strict schemas
gnome-extensions pack --schema=schemas/org.gnome.shell.extensions.consistent-icons.gschema.xml --schema=schemas/gschemas.compiled .
```

The source is licensed under GNU GPL version 2 only. See [LICENSE](LICENSE).

## Preferences

Open **Consistent Icons** in GNOME Extensions to choose the tile background:

- **System** follows GNOME's light or dark appearance.
- **Static color** uses GNOME's accent color or a color you select.
- **Gradient** samples up to five visible colors from each effective app icon. Choose a linear, radial, or wave style; linear gradients have eight directions.

Changes apply to existing icons immediately. These options affect only icons that receive a tile under the shape rules above.
