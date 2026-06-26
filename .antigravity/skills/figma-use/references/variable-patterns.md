# Variable & Token API Patterns

> Part of the [use_figma skill](../SKILL.md). How to correctly create, bind, scope, and alias variables using the Plugin API.

## Contents

- Creating Variable Collections and Modes
- Creating Variables (All Types)
- Binding Variables to Node Properties
- Variable Scopes: What They Are and How to Set Them
- Variable Aliasing (VARIABLE_ALIAS)
- Code Syntax (setVariableCodeSyntax)
- Importing Library Variables
- Discovering Existing Variables in the File
- Effect Styles (For Shadows)

## Creating Variable Collections and Modes

```javascript
const collection = figma.variables.createVariableCollection("MyCollection");

// A new collection starts with 1 mode named "Mode 1" — always rename it
collection.renameMode(collection.modes[0].modeId, "Light");

// Add additional modes (returns the new modeId)
const darkModeId = collection.addMode("Dark");
const lightModeId = collection.modes[0].modeId;
```

**Mode limits are plan-dependent:** Free = 1 mode, Professional = up to 4, Organization/Enterprise = 40+. If you need many modes, split across multiple collections.

## Creating Variables (All Types)

`figma.variables.createVariable(name, collection, resolvedType)` — the second argument accepts a collection object or ID string (object preferred).

```javascript
// COLOR — values use {r, g, b, a} (all 0–1 range, includes alpha)
const colorVar = figma.variables.createVariable("my-color", collection, "COLOR");
colorVar.setValueForMode(modeId, { r: 0.2, g: 0.36, b: 0.96, a: 1 });

// FLOAT — for spacing, radii, sizing, numeric values
const floatVar = figma.variables.createVariable("my-spacing", collection, "FLOAT");
floatVar.setValueForMode(modeId, 16);

// STRING — for font families, font style names, any text value
const stringVar = figma.variables.createVariable("my-font", collection, "STRING");
stringVar.setValueForMode(modeId, "Inter");

// BOOLEAN
const boolVar = figma.variables.createVariable("my-flag", collection, "BOOLEAN");
boolVar.setValueForMode(modeId, true);
```

**Note:** Paint colors use `{r, g, b}` (no alpha), but COLOR variable values use `{r, g, b, a}` (with alpha). Don't mix them up.

## Binding Variables to Node Properties

### Color Bindings (Fills, Strokes)

`setBoundVariableForPaint` returns a **NEW paint** — you must capture the return value:

```javascript
// Create a base paint, bind the variable, assign the result
const basePaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
const boundPaint = figma.variables.setBoundVariableForPaint(basePaint, "color", colorVar);
node.fills = [boundPaint];

// Only SOLID paints support color variable binding — gradients/images will throw
```

### Numeric Bindings (Spacing, Radii, Sizing)

`setBoundVariable` binds FLOAT/STRING/BOOLEAN variables to node properties:

```javascript
// Padding
node.setBoundVariable("paddingTop", spacingVar);
node.setBoundVariable("paddingBottom", spacingVar);
node.setBoundVariable("paddingLeft", spacingVar);
node.setBoundVariable("paddingRight", spacingVar);

// Gap
node.setBoundVariable("itemSpacing", gapVar);
node.setBoundVariable("counterAxisSpacing", gapVar);

// Corner radius — use individual corners, NOT cornerRadius
node.setBoundVariable("topLeftRadius", radiusVar);
node.setBoundVariable("topRightRadius", radiusVar);
node.setBoundVariable("bottomLeftRadius", radiusVar);
node.setBoundVariable("bottomRightRadius", radiusVar);

// Size
node.setBoundVariable("width", sizeVar);
node.setBoundVariable("height", sizeVar);
node.setBoundVariable("minWidth", sizeVar);
node.setBoundVariable("maxWidth", sizeVar);

// Other
node.setBoundVariable("opacity", opacityVar);
node.setBoundVariable("strokeWeight", strokeVar);
```

**Not bindable via setBoundVariable:** `fontSize`, `fontWeight`, `lineHeight` — set these directly on text nodes.

### Effect Bindings

```javascript
const effectCopy = JSON.parse(JSON.stringify(node.effects[0]));
const newEffect = figma.variables.setBoundVariableForEffect(effectCopy, "color", colorVar);
// ⚠️ Returns a NEW effect — must capture return value!
node.effects = [newEffect];
// Valid fields: "color" (COLOR), "radius" | "spread" | "offsetX" | "offsetY" (FLOAT)
```

### Applying a Mode to a Frame

```javascript
// All bound children of this frame will resolve to the specified mode's values
frame.setExplicitVariableModeForCollection(collection, modeId);
```

Without this, all nodes use the collection's default (first) mode.

## Variable Scopes: What They Are and How to Set Them

`variable.scopes` controls which Figma property pickers show the variable. The default is `["ALL_SCOPES"]` which shows it everywhere — this is almost never what you want.

```javascript
const colorVar = figma.variables.createVariable("bg-primary", collection, "COLOR");
colorVar.scopes = ["FRAME_FILL", "SHAPE_FILL"]; // background fills only
```
