import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { GET as recipeLink } from "@/app/recipe/[id]/route";
import { GET as blogLink } from "@/app/blog/[id]/route";
import { GET as eventLink } from "@/app/event/[id]/route";
import { GET as cafeLink } from "@/app/cafe/[id]/route";
import { GET as cafesLink } from "@/app/cafes/[id]/route";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-stores";

const ORIGIN = "https://coffeesphut.com";
const routes = [
  { path: "/recipe/886d9e0c-73ec-417b-bca6-813dd9762a29", handler: recipeLink },
  { path: "/blog/df0a64e4-b1e4-4a81-8c4f-817b6a9667bb", handler: blogLink },
  { path: "/event/d2816ecd-0ba2-45e4-854e-429a880dd210", handler: eventLink },
  { path: "/cafe/31", handler: cafeLink },
  { path: "/cafes/31", handler: cafesLink },
];
const devices = [
  {
    name: "iPhone",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    destination: APP_STORE_URL,
  },
  {
    name: "iPad",
    userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    destination: APP_STORE_URL,
  },
  {
    name: "Android",
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
    destination: PLAY_STORE_URL,
  },
  {
    name: "desktop",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
    destination: `${ORIGIN}/#download`,
  },
  {
    name: "unknown device",
    userAgent: "",
    destination: `${ORIGIN}/#download`,
  },
];

for (const { path, handler } of routes) {
  for (const device of devices) {
    test(`${path} sends ${device.name} visitors to the correct download destination`, () => {
      const request = new NextRequest(`${ORIGIN}${path}?source=share`, {
        headers: device.userAgent ? { "user-agent": device.userAgent } : {},
      });
      const response = handler(request);

      assert.equal(response.status, 307);
      assert.equal(response.headers.get("location"), device.destination);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.equal(response.headers.get("vary"), "User-Agent");
    });
  }
}
