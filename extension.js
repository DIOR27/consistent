// Copyright (C) 2026 DIOR27
// SPDX-License-Identifier: GPL-2.0-only

import Cogl from 'gi://Cogl';
import Clutter from 'gi://Clutter';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as IconGrid from 'resource:///org/gnome/shell/ui/iconGrid.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class ConsistentIconsExtension extends Extension {
    enable() {
        this._appPrototype = Shell.App.prototype;
        this._originalCreateIconTexture = this._appPrototype.create_icon_texture;
        this._styledIconActors = new WeakMap();
        const extension = this;

        this._patchedCreateIconTexture = function (size) {
            const source = extension._originalCreateIconTexture.call(this, size);
            const styled = extension._styleAppIcon(source, size);
            if (styled !== source)
                extension._styledIconActors.set(styled, {app: this, size});
            return styled;
        };
        this._appPrototype.create_icon_texture = this._patchedCreateIconTexture;

        this._settings = St.Settings.get();
        this._iconTheme = new St.IconTheme();
        this._analysisCache = new Map();
        this._iconThemeChangedId = this._iconTheme.connect('changed', () => {
            this._analysisCache.clear();
            this._refreshAppIcons();
        });
        this._colorSchemeChangedId = this._settings.connect(
            'notify::color-scheme', () => this._updateTileColors());
        this._refreshAppIcons();
    }

    disable() {
        if (this._colorSchemeChangedId) {
            this._settings.disconnect(this._colorSchemeChangedId);
            this._colorSchemeChangedId = 0;
        }
        if (this._iconThemeChangedId) {
            this._iconTheme.disconnect(this._iconThemeChangedId);
            this._iconThemeChangedId = 0;
        }

        if (this._appPrototype?.create_icon_texture === this._patchedCreateIconTexture)
            this._appPrototype.create_icon_texture = this._originalCreateIconTexture;

        this._restoreDockIcons();
        // Recreate current actors with the original Shell method so padding and
        // background styling disappear immediately when the extension is off.
        this._refreshAppIcons();
        this._appPrototype = null;
        this._originalCreateIconTexture = null;
        this._patchedCreateIconTexture = null;
        this._settings = null;
        this._iconTheme = null;
        this._analysisCache = null;
        this._styledIconActors = null;
    }

    _styleAppIcon(source, size) {
        if (!(source instanceof St.Icon))
            return source;

        const analysis = this._analyzeIcon(source);
        if (analysis?.shape === 'rounded-square')
            return source;

        if (analysis?.shape === 'square') {
            try {
                const rounded = this._createImageActor(
                    analysis.pixbuf, size, true, analysis.bounds);
                source.destroy();
                return rounded;
            } catch (error) {
                console.debug(`Consistent Icons: cannot round square icon: ${error.message}`);
            }
        } else if (analysis?.shape === 'other') {
            try {
                const contentSize = Math.max(1, Math.round(size * 0.70));
                const image = this._createImageActor(
                    analysis.pixbuf, contentSize, false, analysis.bounds);
                source.destroy();
                return this._createTile(image, size);
            } catch (error) {
                console.debug(`Consistent Icons: cannot render icon image: ${error.message}`);
            }
        }

        const contentSize = Math.max(1, Math.round(size * 0.70));
        source.x_align = Clutter.ActorAlign.CENTER;
        source.y_align = Clutter.ActorAlign.CENTER;
        source.set_size(contentSize, contentSize);
        return this._createTile(source, size);
    }

    _styleTile(tile, size) {
        const variant = Main.getStyleVariant();
        const dark = variant === 'dark' ||
            (variant === '' && this._settings.colorScheme === St.SystemColorScheme.PREFER_DARK);
        const radius = Math.max(3, Math.round(size * 0.22));
        const style = dark
            ? `background-color: #292a30; border: 1px solid rgba(255,255,255,0.045); border-radius: ${radius}px; box-shadow: 0 1px 3px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.065);`
            : `background-color: #f1f2f4; border: 1px solid rgba(255,255,255,0.55); border-radius: ${radius}px; box-shadow: 0 1px 3px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.72);`;
        tile.set_style(style);
    }

    _createTile(icon, size) {
        const tile = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            style_class: 'consistent-app-icon-tile',
            width: size,
            height: size,
            reactive: false,
            can_focus: false,
        });
        tile.add_child(icon);
        const syncSize = () => {
            const tileSize = Math.max(tile.width, tile.height, size);
            const contentSize = Math.max(1, Math.round(tileSize * 0.70));
            icon.set_size(contentSize, contentSize);
            this._styleTile(tile, tileSize);
        };
        tile.connect('notify::width', syncSize);
        tile.connect('notify::height', syncSize);
        this._styleTile(tile, size);
        return tile;
    }

    _analyzeIcon(icon) {
        if (!(icon instanceof St.Icon))
            return null;

        const gicon = icon.gicon ?? (icon.icon_name
            ? new Gio.ThemedIcon({name: icon.icon_name})
            : null);
        if (!gicon)
            return null;

        const key = gicon.to_string();
        if (this._analysisCache.has(key))
            return this._analysisCache.get(key);

        let analysis = null;
        try {
            // Inspect the actual icon actor's GIcon: themed icons resolve via
            // the active pack; file icons use the exact image supplied to Shell.
            const pixbuf = gicon instanceof Gio.FileIcon
                ? GdkPixbuf.Pixbuf.new_from_file(gicon.get_file().get_path())
                : this._iconTheme.lookup_by_gicon(
                    gicon, 96, St.IconLookupFlags.FORCE_SIZE)?.load_icon();
            if (pixbuf)
                analysis = {...this._classifyShape(pixbuf), pixbuf};
        } catch (error) {
            console.debug(`Consistent Icons: cannot inspect icon: ${error.message}`);
        }

        this._analysisCache.set(key, analysis);
        return analysis;
    }

    _classifyShape(pixbuf) {
        const imageWidth = pixbuf.get_width();
        const imageHeight = pixbuf.get_height();
        const pixels = pixbuf.get_pixels();
        const channels = pixbuf.get_n_channels();
        const rowstride = pixbuf.get_rowstride();
        const alpha = (x, y) => channels === 4
            ? pixels[y * rowstride + x * channels + 3]
            : 255;
        let minX = imageWidth;
        let minY = imageHeight;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < imageHeight; y++) {
            for (let x = 0; x < imageWidth; x++) {
                if (alpha(x, y) < 120)
                    continue;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }

        if (maxX < minX || maxY < minY)
            return {shape: 'other'};
        const width = maxX - minX + 1;
        const height = maxY - minY + 1;
        if (width < 16 || height < 16 ||
            Math.abs(width - height) > Math.max(width, height) * 0.06)
            return {shape: 'other', bounds: {x: minX, y: minY, width, height}};

        const sample = (x, y) => {
            const px = minX + Math.round(x * (width - 1));
            const py = minY + Math.round(y * (height - 1));
            return alpha(px, py);
        };
        const opaque = (x, y) => sample(x, y) >= 210;
        const edgeMids = [[0.5, 0.02], [0.5, 0.98], [0.02, 0.5], [0.98, 0.5]];
        if (!edgeMids.every(([x, y]) => opaque(x, y)))
            return {shape: 'other', bounds: {x: minX, y: minY, width, height}};

        const directions = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
        const roundedCorners = directions.every(([xDir, yDir]) => {
            const point = (x, y) => sample(xDir > 0 ? x : 1 - x, yDir > 0 ? y : 1 - y);
            if (point(0.02, 0.02) >= 120 || point(0.12, 0.12) < 210)
                return false;

            // A curved corner reaches the side before the diagonal does; this
            // separates a rounded square from circular or irregular artwork.
            const offsets = [0.06, 0.1, 0.14, 0.18, 0.22, 0.26, 0.3];
            return offsets.some(offset => point(0.02, offset) >= 210 &&
                point(offset, 0.02) >= 210);
        });
        if (roundedCorners)
            return {shape: 'rounded-square', bounds: {x: minX, y: minY, width, height}};

        const sharpCorners = directions.every(([xDir, yDir]) => {
            const x = xDir > 0 ? 0.02 : 0.98;
            const y = yDir > 0 ? 0.02 : 0.98;
            const insetX = xDir > 0 ? 0.04 : 0.96;
            const insetY = yDir > 0 ? 0.04 : 0.96;
            return opaque(x, y) || opaque(insetX, insetY);
        });
        return {shape: sharpCorners ? 'square' : 'other',
            bounds: {x: minX, y: minY, width, height}};
    }

    _createImageActor(pixbuf, size, roundCorners = false, bounds = null) {
        const xOffset = bounds?.x ?? 0;
        const yOffset = bounds?.y ?? 0;
        const width = bounds?.width ?? pixbuf.get_width();
        const height = bounds?.height ?? pixbuf.get_height();
        const pixels = pixbuf.get_pixels();
        const channels = pixbuf.get_n_channels();
        const rowstride = pixbuf.get_rowstride();
        const rgba = new Uint8Array(width * height * 4);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const source = (y + yOffset) * rowstride + (x + xOffset) * channels;
                const target = (y * width + x) * 4;
                rgba[target] = pixels[source];
                rgba[target + 1] = pixels[source + 1];
                rgba[target + 2] = pixels[source + 2];
                rgba[target + 3] = channels === 4 ? pixels[source + 3] : 255;

                if (roundCorners) {
                    const radius = Math.min(width, height) * 0.22;
                    const centerX = Math.max(radius, Math.min(width - radius, x + 0.5));
                    const centerY = Math.max(radius, Math.min(height - radius, y + 0.5));
                    const distance = Math.hypot(x + 0.5 - centerX, y + 0.5 - centerY);
                    const coverage = Math.clamp(radius + 0.5 - distance, 0, 1);
                    rgba[target + 3] = Math.round(rgba[target + 3] * coverage);
                }
            }
        }

        const content = new St.ImageContent({preferredWidth: width, preferredHeight: height});
        const coglContext = [];
        const backend = global.stage?.context?.get_backend?.();
        if (content.set_bytes.length === 6 && backend?.get_cogl_context)
            coglContext.push(backend.get_cogl_context());
        content.set_bytes(...coglContext, GLib.Bytes.new(rgba), Cogl.PixelFormat.RGBA_8888,
            width, height, width * 4);

        return new St.Widget({
            content,
            content_gravity: Clutter.ContentGravity.RESIZE_ASPECT,
            width: size,
            height: size,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            reactive: false,
            can_focus: false,
        });
    }

    _refreshAppIcons() {
        const iconWidgets = new Set();
        const dockIcons = [];
        const visit = actor => {
            if (actor instanceof IconGrid.BaseIcon)
                iconWidgets.add(actor);
            else if (actor.app && actor.icon?.update && typeof actor._createIcon === 'function')
                iconWidgets.add(actor.icon);
            const app = actor.app ?? actor._taskbarApp;
            const property = actor.icon instanceof St.Icon || actor.icon instanceof St.Widget
                ? 'icon'
                : '_taskbarIcon';
            const icon = actor[property];
            const previous = icon && this._styledIconActors.get(icon);
            if (previous || (app?.create_icon_texture && icon instanceof St.Icon))
                dockIcons.push({owner: actor, app: previous?.app ?? app,
                    icon, property, size: previous?.size ?? icon.icon_size ?? icon.width ?? 32});
            for (const child of actor.get_children())
                visit(child);
        };
        visit(global.stage);

        for (const icon of iconWidgets) {
            if (icon instanceof IconGrid.BaseIcon && typeof icon._createIconTexture === 'function')
                icon._createIconTexture(icon.iconSize);
            else
                icon.update();
        }

        for (const {owner, app, icon, property, size} of dockIcons) {
            const parent = icon.get_parent();
            if (!parent)
                continue;

            const index = parent.get_children().indexOf(icon);
            const replacement = app.create_icon_texture(size);
            if (replacement === icon)
                continue;

            if (replacement.get_parent() !== parent)
                parent.insert_child_at_index(replacement, index);
            owner[property] = replacement;
            icon.destroy();
        }
    }

    _restoreDockIcons() {
        const restore = (owner, property) => {
            const styled = owner[property];
            const info = styled && this._styledIconActors.get(styled);
            if (!info)
                return;

            const parent = styled.get_parent();
            if (!parent)
                return;
            const index = parent.get_children().indexOf(styled);
            const source = this._originalCreateIconTexture.call(info.app, info.size);
            parent.insert_child_at_index(source, index);
            owner[property] = source;
            styled.destroy();
        };
        const visit = actor => {
            restore(actor, 'icon');
            restore(actor, '_taskbarIcon');
            for (const child of actor.get_children())
                visit(child);
        };
        visit(global.stage);
    }

    _updateTileColors() {
        const visit = actor => {
            if (actor.has_style_class_name?.('consistent-app-icon-tile')) {
                const size = actor.width || actor.height || 16;
                this._styleTile(actor, size);
            }
            for (const child of actor.get_children())
                visit(child);
        };
        visit(global.stage);
    }
}
