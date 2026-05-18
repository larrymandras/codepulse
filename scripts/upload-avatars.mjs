import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { readFileSync } from "fs";
import { resolve } from "path";

const CONVEX_URL = process.env.VITE_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("Set VITE_CONVEX_URL env var first");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

const AVATAR_DIR = "C:/Users/mandr/Downloads/agent-avatars";

const ASSIGNMENTS = [
  { name: "Ástríðr", file: "astridr.png", contentType: "image/png" },
  { name: "Hervor", file: "hervor.jpg", contentType: "image/jpeg" },
  { name: "Freya", file: "freya.jpg", contentType: "image/jpeg" },
  { name: "Brynhildr", file: "brynhildr.jpg", contentType: "image/jpeg" },
  { name: "Ragnhildr", file: "ragnhildr.jpg", contentType: "image/jpeg" },
  { name: "Göndul", file: "gondul.jpg", contentType: "image/jpeg" },
  { name: "Skuld", file: "skuld.jpg", contentType: "image/jpeg" },
  { name: "Hildr", file: "hildr.jpg", contentType: "image/jpeg" },
  { name: "Iðunn", file: "idunn.jpg", contentType: "image/jpeg" },
  { name: "Urðr", file: "urdhr.jpg", contentType: "image/jpeg" },
  { name: "Verðandi", file: "verdandi.jpg", contentType: "image/jpeg" },
];

const avatars = await client.query(api.avatars.list);
console.log(`Found ${avatars.length} avatars in DB\n`);

for (const assign of ASSIGNMENTS) {
  const avatar = avatars.find((a) => a.name === assign.name);
  if (!avatar) {
    console.log(`SKIP: No avatar record for ${assign.name}`);
    continue;
  }

  const filePath = resolve(AVATAR_DIR, assign.file);
  const fileData = readFileSync(filePath);

  console.log(`Uploading ${assign.file} for ${assign.name}...`);

  const uploadUrl = await client.mutation(api.avatars.generateUploadUrl);

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": assign.contentType },
    body: fileData,
  });

  if (!response.ok) {
    console.error(`  FAILED: ${response.status} ${response.statusText}`);
    continue;
  }

  const { storageId } = await response.json();
  await client.mutation(api.avatars.saveImage, { id: avatar._id, storageId });
  console.log(`  OK: ${assign.name} -> ${storageId}`);
}

console.log("\nDone! All avatars uploaded.");
