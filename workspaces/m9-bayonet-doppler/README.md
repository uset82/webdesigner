# M9 Bayonet | Doppler Phase 2 — img2threejs v1.3

**Real solid 3D** reconstruction (extruded traced silhouette + projected Doppler crops), not a flat emboss plate.

Ported from the official [img2threejs-showcase](https://github.com/hoainho/img2threejs-showcase) demo `m9-doppler` (author [kokorolx](https://github.com/kokorolx)), built with **img2threejs v1.3**.

## What makes this different from the CA² logo demo

| | CA² monogram workspace | This workspace |
|--|------------------------|----------------|
| Method | Reference emboss on thin planes | Traced outline → `ExtrudeGeometry` + wedge taper |
| Parts | Texture cards | Blade, guard, ring, grip segments, pommel, tang |
| Materials | Keyed PNG albedo | Doppler crop projection + procedural knurl |
| Orbit | Flat logo on navy card | Free 3D object you can orbit from tip / pommel / spine |

## Run

```powershell
cd E:\PROYECTOS\webdesigner\workspaces\m9-bayonet-doppler
npm install
npm run dev
```

Open **http://localhost:5179/**

- Drag to orbit  
- Scroll to zoom  
- Automatic slow studio rock  

## Layout

| Path | Role |
|------|------|
| `ref/m9-doppler.jpg` | Source broadside reference |
| `public/m9-doppler/blade-fill.png` | Projected blade albedo crop |
| `public/m9-doppler/handle-fill.png` | Projected grip albedo crop |
| `src/geo.json` | Traced blade/handle silhouette from the photo |
| `src/m9-bayonet.js` | img2threejs factory (code-only geometry) |
| `src/createM9DopplerModel.ts` | Showcase adapter + look-dev lights |
| `src/main.ts` | Studio viewer |

## Upstream

- Skill: https://github.com/hoainho/img2threejs  
- Showcase: https://hoainho.github.io/img2threejs-showcase/#/demo/m9-doppler  
- Source: https://github.com/hoainho/img2threejs-showcase/blob/main/src/demos/m9-doppler/createM9DopplerModel.ts  
