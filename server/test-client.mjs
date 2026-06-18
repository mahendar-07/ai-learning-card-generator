import WebSocket from "ws";

function runScenario(name, { failureScenario }) {
  return new Promise((resolve) => {
    const ws = new WebSocket("ws://localhost:4000");
    const log = (msg) => console.log(`[${name}]`, msg);

    ws.on("open", () => {
      log("connected, sending generate request");
      ws.send(JSON.stringify({ type: "generate", topic: "Photosynthesis", failureScenario }));
    });

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      log(JSON.stringify(msg));

      if (msg.type === "card_error") {
        log(`card ${msg.index} failed, retrying on the SAME connection`);
        ws.send(JSON.stringify({ type: "retry", cardIndex: msg.index }));
      }
      if (msg.type === "complete") {
        log("done, closing");
        ws.close();
      }
    });

    ws.on("close", () => {
      log("connection closed");
      resolve();
    });

    ws.on("error", (err) => log("ERROR " + err.message));
  });
}

// Manual smoke test for all WebSocket failure scenarios.
// Run with the server already started: `node test-client.mjs`
(async () => {
  await runScenario("SCENARIO-NONE (success)", { failureScenario: "none" });
  console.log("\n---\n");
  
  await runScenario("SCENARIO-CASE-1 (all fail)", { failureScenario: "case-1" });
  console.log("\n---\n");
  
  await runScenario("SCENARIO-CASE-2 (one fails random)", { failureScenario: "case-2" });
  console.log("\n---\n");
  
  await runScenario("SCENARIO-CASE-3 (two fail random)", { failureScenario: "case-3" });
})();
