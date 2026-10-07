/* Wires the UI to the agent pipeline:
   1. identity (in-app = already signed in)  2. code guardrails before the model
   3. agent with tools  4. code guardrails after the model  5. reply or handoff */
(function () {
  var D = window.DEMO, G = window.GUARDRAILS;
  var $ = function (id) { return document.getElementById(id); };
  var state = { mode: "sim", member: "WHP-004817", history: [], busy: false, handoffs: 0 };
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, reduce ? 0 : ms); }); };

  var TAGS = { start: "Message in", identity: "Identity", guard: "Guardrail", blocked: "Blocked", think: "Agent", tool: "Tool call",
    result: "Tool result", reply: "Reply sent", handoff: "Handoff", error: "Error" };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function trace(type, title, detail) {
    var li = document.createElement("li");
    li.className = "tr " + type;
    li.innerHTML = '<span class="tag">' + TAGS[type] + '</span><div class="tbody"><div class="ttitle">' + esc(title) + '</div>' +
      (detail ? '<pre>' + esc(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2)) + '</pre>' : '') + '</div>';
    $("trace").appendChild(li);
    $("trace-empty").hidden = true;
    li.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }

  async function callTool(name, input) {
    trace("tool", name, input);
    await wait(350);
    var out = window.AGENT_TOOLS.run(name, input);
    trace("result", name + (out.error ? " (error)" : ""), out);
    await wait(250);
    return out;
  }

  window.onHandoff = function (c) {
    state.handoffs += 1;
    var queueNames = { rep: "Rep", senior_rep: "Senior rep", retention: "Retention specialist", health_specialist: "Health specialist" };
    var div = document.createElement("article");
    div.className = "case";
    div.innerHTML = '<div class="case-top"><b>Case ' + esc(c.case_number) + '</b><span class="pill">' + esc(queueNames[c.queue] || c.queue) + '</span></div>' +
      '<dl><dt>Reason</dt><dd>' + esc(c.reason) + '</dd><dt>Summary</dt><dd>' + esc(c.summary) + '</dd>' +
      (c.recommendation ? '<dt>AI suggestion</dt><dd>' + esc(c.recommendation) + ' <span class="muted">A person decides.</span></dd>' : '') +
      '<dt>Member</dt><dd>' + esc(state.member) + ', signed in through the app</dd></dl>' +
      '<p class="muted small">Created in ' + esc(c.created_in) + '. The rep replies to this same chat.</p>';
    $("cases").prepend(div);
    $("cases-empty").hidden = true;
    trace("handoff", "Case " + c.case_number + " created for the " + (queueNames[c.queue] || c.queue) + " queue", { reason: c.reason });
  };

  function bubble(who, text, cls) {
    var d = document.createElement("div");
    d.className = "msg " + cls;
    d.innerHTML = '<span class="who">' + esc(who) + '</span>' + esc(text);
    $("chat").appendChild(d);
    $("chat").scrollTop = $("chat").scrollHeight;
  }

  async function handle(text) {
    if (state.busy || !text.trim()) return;
    state.busy = true; setBusy(true);
    var m = D.members[state.member];
    bubble(m.name, text, "me");
    trace("start", "In-app message from " + m.name);
    trace("identity", "Signed in through the WHOOP app as " + state.member + ". No extra check needed.");
    var before = state.handoffs;

    try {
      if (G.injection(text)) trace("guard", "Instruction-override attempt detected. Chat messages can't change the agent's rules.");

      var h = G.health(text);
      if (h.sensitive) {
        trace("guard", h.urgent ? "Urgent health words found. Emergency guidance sent. The model is not used." : "Health-sensitive. The model is not used for this message.");
        await callTool("handoff_to_human", { queue: "health_specialist", reason: h.urgent ? "Urgent health concern" : "Question about health readings",
          summary: m.name + ": " + text });
        await wait(300);
        bubble("WHOOP assistant", h.urgent ? G.EMERGENCY_TEXT : G.HEALTH_TEXT, "bot");
        trace("reply", "Fixed safety reply sent");
        return;
      }

      var asked = G.moneyRequest(text) || G.injection(text);
      if (asked) trace("guard", "Money-related request. Only a person can decide this.");

      var ctx = { trace: trace, callTool: callTool, history: state.history, cfg: { key: $("apikey").value.trim(), model: $("model").value.trim() } };
      var agent = state.mode === "claude" ? window.CLAUDE_AGENT : window.SIM_AGENT;
      var reply = await agent.respond(text, state.member, ctx);

      var hit = G.monetaryCommitment(reply);
      if (hit) {
        trace("blocked", "Reply blocked: it committed to money (\"" + hit + "\"). Replaced with a safe reply.", reply);
        reply = G.BLOCKED_TEXT;
      }
      if ((hit || asked) && state.handoffs === before) {
        trace("guard", "Money request with no handoff. Creating one automatically.");
        await callTool("handoff_to_human", { queue: "rep", reason: "Money-related request", summary: m.name + ": " + text });
      }
      bubble("WHOOP assistant", reply, "bot");
      trace("reply", state.handoffs > before ? "Reply sent. A person now owns the case." : "Resolved by the agent");
    } catch (e) {
      trace("error", e.message || String(e));
      bubble("WHOOP assistant", "Sorry, something went wrong on my side. I've asked a person to take a look.", "bot");
    } finally {
      state.busy = false; setBusy(false);
    }
  }

  function setBusy(b) { $("send").disabled = b; $("msg").disabled = b; document.querySelectorAll(".scenario").forEach(function (x) { x.disabled = b; }); }

  function reset() {
    state.history = []; $("chat").innerHTML = ""; $("trace").innerHTML = ""; $("cases").innerHTML = "";
    $("trace-empty").hidden = false; $("cases-empty").hidden = false;
    bubble("WHOOP assistant", "Hi " + D.members[state.member].name.split(" ")[0] + ", how can I help today?", "bot");
  }

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll("[data-mode]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.mode === mode ? "true" : "false"); });
    $("keybox").hidden = mode !== "claude";
    $("modenote").textContent = mode === "claude" ? "Real model. Same tools, same code guardrails." : "Rule-based agent. Works offline, no API key.";
    reset();
  }

  function init() {
    $("member").innerHTML = Object.keys(D.members).map(function (id) { return '<option value="' + id + '">' + D.members[id].name + ' (' + D.members[id].tier + ')</option>'; }).join("");
    $("member").value = state.member;
    $("member").addEventListener("change", function () { state.member = this.value; reset(); });
    $("scenarios").innerHTML = D.scenarios.map(function (s, i) { return '<button class="scenario" data-i="' + i + '">' + esc(s.label) + '</button>'; }).join("");
    document.querySelectorAll(".scenario").forEach(function (b) {
      b.addEventListener("click", function () {
        var s = D.scenarios[+b.dataset.i];
        if (state.member !== s.member) { state.member = s.member; $("member").value = s.member; reset(); }
        handle(s.text);
      });
    });
    $("cannot").innerHTML = G.CANNOT_DO.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("");
    $("composer").addEventListener("submit", function (e) { e.preventDefault(); var v = $("msg").value; $("msg").value = ""; handle(v); });
    document.querySelectorAll("[data-mode]").forEach(function (b) { b.addEventListener("click", function () { setMode(b.dataset.mode); }); });
    $("reset").addEventListener("click", reset);
    setMode("sim");
  }
  init();
})();
