// Copyright (C) 2026 DIOR27
// SPDX-License-Identifier: GPL-2.0-only

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const BackgroundMode = Object.freeze({
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
        const page = new Adw.PreferencesPage({title: 'Apariencia'});
        const modeGroup = new Adw.PreferencesGroup({
            title: 'Fondo de los iconos',
            description: 'El estilo se aplica a las placas que añade la extensión.',
        });
        addComboRow(modeGroup, settings, 'background-mode',
            'Estilo del fondo', ['Sistema', 'Color estático', 'Gradiente']);

        const solidGroup = new Adw.PreferencesGroup({title: 'Color estático'});
        addComboRow(solidGroup, settings, 'solid-color-source',
            'Origen del color', ['Color de acento de GNOME', 'Color personalizado']);
        const colorDialog = new Gtk.ColorDialog({
            title: 'Elige un color',
            with_alpha: false,
        });
        const colorButton = new Gtk.ColorDialogButton({dialog: colorDialog});
        const initialColor = new Gdk.RGBA();
        if (initialColor.parse(settings.get_string('solid-color')))
            colorButton.set_rgba(initialColor);
        colorButton.connect('notify::rgba', () =>
            settings.set_string('solid-color', colorButton.rgba.to_string()));
        const colorRow = new Adw.ActionRow({
            title: 'Color personalizado',
            subtitle: 'Se usa cuando el origen es Color personalizado.',
            activatable_widget: colorButton,
        });
        colorRow.add_suffix(colorButton);
        solidGroup.add(colorRow);

        const gradientGroup = new Adw.PreferencesGroup({title: 'Gradiente'});
        const gradientStyleRow = addComboRow(gradientGroup, settings, 'gradient-style',
            'Estilo', ['Lineal', 'Radial', 'Onda']);
        const directionRow = addComboRow(gradientGroup, settings, 'gradient-direction',
            'Dirección lineal', [
                'Izquierda a derecha',
                'Diagonal: arriba izquierda a abajo derecha',
                'Arriba a abajo',
                'Diagonal: arriba derecha a abajo izquierda',
                'Derecha a izquierda',
                'Diagonal: abajo derecha a arriba izquierda',
                'Abajo a arriba',
                'Diagonal: abajo izquierda a arriba derecha',
            ]);
        const waveRow = addComboRow(gradientGroup, settings, 'wave-orientation',
            'Dirección de onda', [
                'Izquierda a derecha',
                'Arriba a abajo',
                'Derecha a izquierda',
                'Abajo a arriba',
                'Diagonal: arriba izquierda a abajo derecha',
                'Diagonal: arriba derecha a abajo izquierda',
                'Diagonal: abajo derecha a arriba izquierda',
                'Diagonal: abajo izquierda a arriba derecha',
            ]);
        const radialCenterRow = addComboRow(gradientGroup, settings, 'radial-center',
            'Centro del gradiente radial', [
                'Centro',
                'Izquierda',
                'Arriba izquierda',
                'Arriba',
                'Arriba derecha',
                'Derecha',
                'Abajo derecha',
                'Abajo',
                'Abajo izquierda',
            ]);

        page.add(modeGroup);
        page.add(solidGroup);
        page.add(gradientGroup);
        window.add(page);

        const updateVisibility = () => {
            const mode = settings.get_int('background-mode');
            const source = settings.get_int('solid-color-source');
            const gradientStyle = settings.get_int('gradient-style');
            solidGroup.visible = mode === BackgroundMode.SOLID;
            colorRow.visible = source === SolidColorSource.CUSTOM;
            gradientGroup.visible = mode === BackgroundMode.GRADIENT;
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
