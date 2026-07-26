# Tabbed Stack Card

![HACS](https://img.shields.io/badge/HACS-Default-blue)
![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2025.1%2B-blue)
![License](https://img.shields.io/github/license/Swiftrail84/tabbed-stack-card)
![Version](https://img.shields.io/github/v/release/Swiftrail84/tabbed-stack-card)

**Create clean, responsive Home Assistant dashboards with a tab experience that feels native.**

![Dashboard Overview](screenshots/dashboard-overview.png)

I built Tabbed Stack Card because I wanted a tab component that feels like a natural part of Home Assistant. Rather than adding another feature-rich custom card, the goal was to create an intuitive dashboard component that stays out of the way, adapts to every screen size and lets users focus on their home—not on the interface.

---

## Responsive by Design

![Responsive Navigation](screenshots/responsive-tabs.gif)

Tabbed Stack Card continuously adapts to the available width.

If all tabs fit, they are shown on a single row.

If additional tabs no longer fit, they are automatically moved to the next page. Navigation controls appear only when additional pages are required.
This keeps the interface clean while ensuring that every tab remains fully visible.

No configuration is required.

The behaviour is completely automatic.

---

## Why Tabbed Stack Card?

Home Assistant dashboards naturally grow over time.

What often starts as a handful of cards quickly turns into long pages filled with sections, headings and endless scrolling. While tabs are an obvious way to organize content, many implementations become difficult to use once the number of tabs increases or the dashboard is viewed on a phone.

Tabbed Stack Card was created to solve exactly this problem. The result is a navigation experience that scales naturally from just a few tabs to large dashboards with many sections—without sacrificing clarity or usability.

Instead of relying on horizontal scrolling, the card automatically adapts to the available space and keeps navigation intuitive on every screen size. Whether the dashboard is opened on a desktop monitor, a tablet or a smartphone, the user experience remains consistent and predictable.

The project is intentionally focused on usability rather than feature count.

Every feature exists for one reason:

**to make Home Assistant dashboards easier to build, easier to navigate and easier to maintain.**


---

## Design Philosophy

Every decision made during the development of this card follows three simple principles.

### 🎨 Visual First

Configuration should happen inside Home Assistant whenever possible.

Instead of editing YAML for every little change, the built-in editor exposes nearly every available option through an intuitive graphical interface.

YAML remains available whenever it is needed, but it should never be required for everyday use.

---

### 📱 Mobile First

Many Home Assistant dashboards are primarily used on phones.

Tabbed Stack Card has therefore been designed with touch interaction as a first-class citizen.

Responsive layouts, swipe gestures and adaptive tab paging ensure that the dashboard remains comfortable to use regardless of screen size.

---

### 🏠 Native Experience

A custom card should not feel like a foreign application inside Home Assistant.

Colors, controls and interaction patterns have been designed to blend naturally into the existing Home Assistant interface, allowing the card to feel like a native component rather than an extension.

---

## Features

| Feature | Benefit |
|----------|---------|
| 🖥️ Built-in visual editor | Configure almost everything without editing YAML |
| 📐 Responsive tab paging | No horizontal scrolling, regardless of screen size |
| 👆 Swipe navigation | Natural interaction on touch devices |
| ⚡ Lazy loading | Faster dashboard loading, especially with many cards |
| 💡 Activity indicators | Instantly identify tabs containing active devices |
| 🎨 Extensive customization | Fonts, colors, spacing and layout can be adjusted |
| 🧩 Native icon picker | Use Home Assistant's familiar icon selection |
| 📄 YAML support | Full flexibility whenever advanced configuration is required |
| 📱 Mobile optimized | Designed to work equally well on phones, tablets and desktops |
| 🚀 Lightweight | No external dependencies required |

---

## Screenshots

### Dashboard Overview

![Dashboard](screenshots/dashboard-overview.png)

A realistic Home Assistant dashboard showing:

- 5–7 tabs
- several different card types
- one selected tab
- multiple activity indicators
- dark mode

This should become the project's hero image.

---

### Visual Editor

![Visual Editor](screenshots/editor-overview.png)

Display the complete editor including:

- General appearance settings
- Active tab settings
- Activity indicator settings
- Multiple configured tabs

This screenshot should immediately demonstrate that the card offers a powerful graphical configuration interface.

---

### General Appearance

![Appearance](screenshots/editor-general.png)

Focus on the appearance section showing typography, colors, padding and sizing options.

---

### Tab Configuration

![Tab Configuration](screenshots/editor-tab.png)

Display one expanded tab including:

- Tab name
- Icon picker
- Enable/disable switch
- YAML editor

---

### Mobile Layout

![Mobile](screenshots/mobile-dashboard.png)

Show the same dashboard on a smartphone.

The image should demonstrate that fewer tabs fit on the screen while navigation remains clean and intuitive.

---

### Activity Indicators

![Activity Indicators](screenshots/activity-indicators.png)

Display several tabs with different indicator states.

The purpose of the feature should be understandable without reading the accompanying text.

---

## Installation

### HACS

Search for **Tabbed Stack Card** inside HACS and install the card.

Restart Home Assistant if required.

The dashboard resource will usually be added automatically.

---

### Manual Installation

Copy

```
tabbed-stack-card.js
```

to

```
/config/www/
```

Add the following dashboard resource:

```yaml
url: /local/tabbed-stack-card.js
type: module
```

Restart Home Assistant.

## Getting Started

A Tabbed Stack Card consists of one or more **tabs**.

Each tab acts as a container for one or multiple Home Assistant cards, allowing related information to be grouped together while keeping the dashboard compact and easy to navigate.

The card itself does not replace existing Home Assistant cards—it simply organizes them into an intuitive tabbed interface.

Most users will create and configure their tabs directly from the built-in visual editor. YAML remains fully supported for advanced configurations or users who prefer manual editing.

---

## Basic Configuration

The simplest configuration consists of two tabs containing standard Home Assistant cards.

```yaml
type: custom:tabbed-stack-card
tabs:
  - label: Living Room
    icon: mdi:sofa
    cards:
      - type: entities
        entities:
          - light.living_room
          - switch.tv

  - label: Climate
    icon: mdi:thermometer
    cards:
      - type: thermostat
        entity: climate.house
```

---

## Multiple Cards per Tab

Tabs are not limited to a single card.

Each tab can contain any number of Home Assistant cards, making it possible to group complete dashboard sections behind a single tab.

```yaml
type: custom:tabbed-stack-card
tabs:
  - label: Home
    icon: mdi:home

    cards:
      - type: entities
        entities:
          - light.kitchen
          - light.dining_room
          - switch.coffee_machine

      - type: glance
        entities:
          - binary_sensor.front_door
          - binary_sensor.garage

      - type: weather-forecast
        entity: weather.home
```

---

# Visual Editor

Tabbed Stack Card has been designed around its visual editor.
Instead of forcing users to edit YAML for every change, nearly every aspect of the card can be configured directly inside Home Assistant. The result is a workflow that feels familiar, fast and fully integrated into the existing dashboard editor while still providing full flexibility whenever manual YAML editing is preferred

The editor follows the same design principles as the card itself:

- intuitive
- responsive
- powerful
- familiar to Home Assistant users

---

## General Appearance

![Appearance](screenshots/editor-general.png)

Customize the overall appearance of the tab bar to match your dashboard.

Available options include:

- Font size
- Minimum tab width
- Horizontal spacing
- Text color
- Active tab color
- Background color
- Transparency

Changes are applied immediately, making it easy to experiment with different styles.

---

## Individual Tab Configuration

![Tab Configuration](screenshots/editor-tab.png)

Every tab can be configured independently.

Each tab supports:

- Custom title
- Home Assistant icon picker
- Enable / disable switch
- Individual card configuration
- YAML editor

Disabled tabs remain part of the configuration and can easily be re-enabled later.

---

## Activity Indicators

![Activity Indicators](screenshots/activity-indicators.png)

Activity indicators allow important information to remain visible even when another tab is currently selected.

When supported entities become active, a colored indicator can automatically appear next to the corresponding tab.

Optionally, the tab title and icon can also change color to provide additional visual feedback.

Supported domains currently include:

- `light`
- `switch`
- `fan`
- `cover`
- `climate`
- `humidifier`
- `input_boolean`

This makes it easy to identify active rooms or devices at a glance without opening every tab.

---

## Responsive Navigation

Responsive navigation is the defining feature of Tabbed Stack Card.

Instead of shrinking tabs until they become unreadable or introducing horizontal scrolling, the card automatically calculates how many tabs fit into the available width.

Additional tabs are moved onto separate pages automatically.

Navigation controls only appear when they are actually required.

On touch devices, pages can also be changed using swipe gestures, providing a natural mobile experience without requiring any additional configuration.

---

## Lazy Loading

Large dashboards can contain dozens of cards.

Creating every card immediately would increase loading times and consume unnecessary resources.

Tabbed Stack Card therefore loads only the currently visible tab during the initial render.

Additional tabs are created automatically when they are opened for the first time and remain available afterwards.

This approach improves dashboard responsiveness while remaining completely transparent to the user.

---

# Acknowledgements

Developing a polished Home Assistant custom card requires countless hours of design, experimentation and refinement.

This project also benefited from extensive AI-assisted development using **ChatGPT** and **Claude**, which provided valuable support during brainstorming, debugging and implementation.

Every feature, design decision and final implementation has been reviewed and adapted manually.

---

## Compatibility

- Home Assistant 2025.1+
- Lovelace Dashboards
- HACS
- Manual installation supported
- No external dependencies

---

# License

This project is licensed under the [MIT License](LICENSE).
