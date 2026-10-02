// Copyright (C) 2026 DIOR27
// SPDX-License-Identifier: GPL-2.0-only

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const BackgroundMode = Object.freeze({
    SYSTEM: 0,
    SOLID: 1,
    GRADIENT: 2,
});

const SolidColorSource = Object.freeze({
    CUSTOM: 1,
});

const GradientStyle = Object.freeze({
    LINEAR: 0,
    RADIAL: 1,
    WAVE: 2,
});

function addComboRow(group, settings, key, title, values) {
    const row = new Adw.ComboRow({
        title,
        model: Gtk.StringList.new(values),
        selected: settings.get_int(key),
    });
    row.connect('notify::selected', () => settings.set_int(key, row.selected));
    group.add(row);
    return row;
}

export default class ConsistentIconsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({title: 'Appearance'});
        const modeGroup = new Adw.PreferencesGroup({
            title: 'Icon backgrounds',
            description: 'The selected style applies to tiles added by the extension.',
        });
        addComboRow(modeGroup, settings, 'background-mode',
            'Background style', ['System', 'Solid color', 'Gradient']);
        const appearanceRow = addComboRow(modeGroup, settings, 'system-appearance',
            'Background appearance', ['Follow system', 'Light', 'Dark']);

        const solidGroup = new Adw.PreferencesGroup({title: 'Solid color'});
        addComboRow(solidGroup, settings, 'solid-color-source',
            'Color source', ['GNOME accent color', 'Custom color']);
        const colorDialog = new Gtk.ColorDialog({
            title: 'Choose a color',
            with_alpha: false,
        });
        const colorButton = new Gtk.ColorDialogButton({dialog: colorDialog});
        const initialColor = new Gdk.RGBA();
        if (initialColor.parse(settings.get_string('solid-color')))
            colorButton.set_rgba(initialColor);
        colorButton.connect('notify::rgba', () =>
            settings.set_string('solid-color', colorButton.rgba.to_string()));
        const colorRow = new Adw.ActionRow({
            title: 'Custom color',
            subtitle: 'Used when the color source is Custom color.',
            activatable_widget: colorButton,
        });
        colorRow.add_suffix(colorButton);
        solidGroup.add(colorRow);

        const gradientGroup = new Adw.PreferencesGroup({title: 'Gradient'});
        const gradientSourceRow = addComboRow(gradientGroup, settings, 'gradient-source',
            'Gradient colors', ['Icon colors', 'Wallpaper']);
        const gradientStyleRow = addComboRow(gradientGroup, settings, 'gradient-style',
            'Style', ['Linear', 'Radial', 'Wave']);
        const directionRow = addComboRow(gradientGroup, settings, 'gradient-direction',
            'Linear direction', [
                'Left to right',
                'Diagonal: top left to bottom right',
                'Top to bottom',
                'Diagonal: top right to bottom left',
                'Right to left',
                'Diagonal: bottom right to top left',
                'Bottom to top',
                'Diagonal: bottom left to top right',
            ]);
        const waveRow = addComboRow(gradientGroup, settings, 'wave-orientation',
            'Wave direction', [
                'Left to right',
                'Top to bottom',
                'Right to left',
                'Bottom to top',
                'Diagonal: top left to bottom right',
                'Diagonal: top right to bottom left',
                'Diagonal: bottom right to top left',
                'Diagonal: bottom left to top right',
            ]);
        const radialCenterRow = addComboRow(gradientGroup, settings, 'radial-center',
            'Radial gradient center', [
                'Center',
                'Left',
                'Top left',
                'Top',
                'Top right',
                'Right',
                'Bottom right',
                'Bottom',
                'Bottom left',
            ]);

        page.add(modeGroup);
        page.add(solidGroup);
        page.add(gradientGroup);
        window.add(page);

        const updateVisibility = () => {
            const mode = settings.get_int('background-mode');
            const source = settings.get_int('solid-color-source');
            const gradientStyle = settings.get_int('gradient-style');
            appearanceRow.visible = mode === BackgroundMode.SYSTEM;
            solidGroup.visible = mode === BackgroundMode.SOLID;
            colorRow.visible = source === SolidColorSource.CUSTOM;
            gradientGroup.visible = mode === BackgroundMode.GRADIENT;
            gradientSourceRow.visible = mode === BackgroundMode.GRADIENT;
            directionRow.visible = gradientStyle === GradientStyle.LINEAR;
            waveRow.visible = gradientStyle === GradientStyle.WAVE;
            radialCenterRow.visible = gradientStyle === GradientStyle.RADIAL;
        };

        const changedId = settings.connect('changed', updateVisibility);
        updateVisibility();
        window.connect('close-request', () => {
            settings.disconnect(changedId);
            return false;
        });
    }
}
