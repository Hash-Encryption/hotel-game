import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../app/InteractiveHotelEngine.tsx", import.meta.url), "utf8");
const expected = [
  "/videos/lobby_idle.mp4",
  "/videos/lobby_to_elevator.mp4",
  "/videos/elevator_to_lobby.mp4",
  "/videos/elevator_g_to_f1.mp4",
  "/videos/f1_hallway_landing.mp4",
  "/videos/room_unlock.mp4",
  "/videos/room_tour.mp4",
];
const referenced = [...source.matchAll(/"(\/videos\/[^"\n]+\.mp4)"/g)].map((match) => match[1]);

assert.deepEqual(referenced.sort(), expected.sort(), "component must reference exactly the seven approved assets");
assert.match(source, /Back to Elevator/);
assert.match(source, /const BACK_TO_ELEVATOR_VIDEO: string \| null = null/);
assert.doesNotMatch(source, /BACK_TO_ELEVATOR: VIDEOS\.elevatorToFloor1/);
assert.match(source, /"IDLE" \| "TRANSITIONING" \| "ARRIVED"/);

console.log("Hotel component contract check passed.");
