# V1 Initialization Templates

Use these commands only for the curated v1 stacks.

## Control Plane
- **Next.js control plane UI**: `npx create-next-app@latest webdesigner-control-plane --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`

## Generated Workspaces
- **Next.js**: `npx create-next-app@latest app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
- **React/Vite**: `npm create vite@latest app -- --template react-ts`
- **Flutter**: `flutter create app`
- **Node/Express**: `npm init -y` then `npm install express cors dotenv`

## Notes
- Next.js is the control-plane UI technology, not the universal output runtime.
- Prisma, MongoDB, and MySQL are optional additions after the base workspace exists.
- Unsupported frameworks are intentionally excluded from the guaranteed v1 scaffold path.
