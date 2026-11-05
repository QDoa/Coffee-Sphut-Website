import { readFileSync } from "node:fs";
import { createServer, request } from "node:http";
import { spawn } from "node:child_process";
const env = Object.fromEntries(
  readFileSync(".partner-portal/preview.env", "utf8")
    .trim()
    .split("\n")
    .map((x) => {
      const i = x.indexOf("=");
      return [x.slice(0, i), x.slice(i + 1)];
    }),
);
if (env.SUPABASE_URL !== "http://127.0.0.1:55434")
  throw new Error("Preview must use the isolated loopback API.");
const proxy = createServer((req, res) => {
  const storage = req.url.startsWith("/storage/v1/");
  const remote = request(
    {
      hostname: "127.0.0.1",
      port: storage ? 55435 : 55431,
      path: req.url.replace(storage ? /^\/storage\/v1/ : /^\/rest\/v1/, ""),
      method: req.method,
      headers: req.headers,
    },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    },
  );
  remote.on("error", () => {
    res.writeHead(502);
    res.end("Local test API unavailable");
  });
  req.pipe(remote);
});
proxy.listen(55434, "127.0.0.1");
const child = spawn(
  "pnpm",
  ["dev", "--hostname", "127.0.0.1", "--port", "3100"],
  {
    stdio: "inherit",
    env: { ...process.env, ...env, NODE_ENV: "development" },
  },
);
child.on("exit", (code) => {
  proxy.close();
  process.exitCode = code || 0;
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    child.kill(signal);
    proxy.close();
  });
