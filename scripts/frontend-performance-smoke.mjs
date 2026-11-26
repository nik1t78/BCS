import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../src/components/Dashboard.tsx", import.meta.url), "utf8");

for (const [name, staticImport, lazyImport] of [
  ["Schedule", 'import Schedule from "./components/Schedule";', 'const Schedule = lazy(() => import("./components/Schedule"));'],
  ["Profile", 'import Profile from "./components/Profile";', 'const Profile = lazy(() => import("./components/Profile"));'],
]) {
  assert.ok(!app.includes(staticImport), name + " must not be statically imported by App");
  assert.ok(app.includes(lazyImport), name + " must be lazy-loaded");
}

assert.ok(app.includes("<Suspense"), "App must provide a Suspense boundary for lazy pages");
assert.ok(app.includes('const GlobalSearch = lazy(() => import("./components/GlobalSearch"));'), "Global search overlay must be lazy-loaded");
assert.match(app, /<Suspense\\s+fallback=\\{null\\}>\\s*<GlobalSearch user=\\{user\\} \/>\\s*<\\/Suspense>/, "Global search must render inside a Suspense boundary");
assert.ok(dashboard.includes('const UserPanel = lazy(() => import("./UserPanel"));'), "Dashboard meeting form must stay lazy");
assert.ok(dashboard.includes('const RoomBookingModal = lazy(() => import("./RoomBookingModal"));'), "Room booking modal must be lazy");
assert.ok(dashboard.includes("{bookingOpen && ("), "Room booking modal must mount only when requested");
assert.ok(dashboard.includes("<Suspense") && dashboard.includes('role="status"'), "Room booking modal must show an accessible loading state");
assert.ok(!dashboard.includes('import RoomBookingModal from "./RoomBookingModal";'), "Room booking modal must not be statically imported");
assert.ok(dashboard.includes('import type { MeetingPrefill } from "./UserPanel";'), "UserPanel type dependency must remain type-only");

console.log("Frontend performance smoke checks passed.");
