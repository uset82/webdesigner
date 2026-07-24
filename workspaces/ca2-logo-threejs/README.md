# CA² Monogram — solid 3D (img2threejs style)

**Real extruded geometry** (crescent C, serif A, nested M, Taurus, superscript 2, extruded wordmark) — not a flat emboss plane.

## Run

```powershell
cd E:\PROYECTOS\webdesigner\workspaces\ca2-logo-threejs
npm run dev
# http://localhost:5180/
```

If port busy: `npm run dev:free`

## Parts

| Mesh | Construction |
|------|----------------|
| crescent-c | Beveled extrude (open crescent) |
| letter-a | Beveled extrude + counters for M / Taurus |
| letter-m | Nested extrude |
| taurus | Torus + horn shapes + stem |
| numeral-2 | Beveled extrude |
| wordmark | TextGeometry gold |

Compare to the bayonet quality bar at `workspaces/m9-bayonet-doppler` (port 5179).
