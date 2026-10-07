/* Simulated agent: rule-based, works offline with no API key.
   Same tools and guardrails as the Claude mode, so the behaviour is comparable. */
(function () {
  var G = window.GUARDRAILS;

  async function simulated(text, memberId, ctx) {
    var t = text.toLowerCase();
    var call = ctx.callTool;
    var m = window.DEMO.members[memberId];
    var first = m.name.split(" ")[0];

    if (/\b(lost|stolen|left my strap|missing strap)\b/.test(t)) {
      ctx.trace("think", "Intent: lost or stolen strap");
      var p = await call("check_policy", { member_id: memberId, topic: "lost_or_stolen" });
      if (G.moneyRequest(text)) {
        await call("handoff_to_human", { queue: "rep", reason: "Asks for a free replacement for a lost strap (exception)",
          summary: first + " lost their strap on a flight and asked for a free replacement.",
          recommendation: "Policy v" + p.policy_version + ": lost straps aren't covered. Lock the old strap and decide whether any exception applies." });
        return "Sorry to hear that, " + first + ". Lost straps aren't covered by the warranty, and I can't approve a free replacement myself, so I've passed your request to the team. They'll reply here. In the meantime, you can buy a replacement in the app and your membership carries straight over.";
      }
      return "Sorry to hear that, " + first + ". Lost straps aren't covered by the warranty, but you can buy a replacement in the app and your membership carries straight over. Would you like a person to lock your old strap to your account?";
    }

    if (/\b(upgrade|move to life|switch to life)\b/.test(t)) {
      ctx.trace("think", "Intent: upgrade question");
      await call("get_member", { member_id: memberId });
      var up = await call("check_policy", { member_id: memberId, topic: "upgrade_to_life" });
      return up.answer + " You can review and confirm it in the app under Membership. I can explain the rules, but I can't apply charges myself.";
    }

    if (G.injection(text) || G.moneyRequest(text)) {
      ctx.trace("think", "Intent: refund or money request. This needs a person.");
      var r = await call("check_policy", { member_id: memberId, topic: "refund" });
      await call("handoff_to_human", { queue: "rep", reason: "Refund request",
        summary: first + " is asking for a refund. Last charge: " + r.facts.last_charge + ". Cancellation on file: " + (r.facts.cancellation_on_file ? "yes" : "no") + ".",
        recommendation: "Check support history for a cancellation request, then decide against refund policy v" + r.policy_version + "." });
      return "Thanks, " + first + ". I can see your last charge: " + r.facts.last_charge + ". I can't make decisions about refunds, so I've passed this to a member of the team with the details, so you won't need to repeat yourself. They'll reply in this chat.";
    }

    if (/\b(downgrade|drop to|switch to one|cancel)\b/.test(t)) {
      ctx.trace("think", "Intent: downgrade. Possible churn, so a retention specialist should follow up.");
      var d = await call("check_policy", { member_id: memberId, topic: "downgrade" });
      await call("handoff_to_human", { queue: "retention", reason: "Considering a downgrade",
        summary: first + " asked about moving to a lower tier.", recommendation: "Walk through plan differences before the change." });
      return d.answer + " Someone from the team will also reply here in case you'd like help choosing.";
    }

    if (/\b(won'?t charge|not charging|battery|broken|stopped reading|defect|faulty|won'?t turn on)\b/.test(t)) {
      ctx.trace("think", "Intent: possible hardware fault");
      var dev = await call("get_device_status", { member_id: memberId });
      var w = await call("check_policy", { member_id: memberId, topic: "warranty" });
      await call("handoff_to_human", { queue: w.likely_eligible ? "rep" : "senior_rep",
        reason: w.likely_eligible ? "Warranty replacement review" : "Warranty check: purchase channel not verified",
        summary: first + ": " + text + (dev.battery_check ? " Battery check: " + dev.battery_check + "." : ""),
        recommendation: w.likely_eligible ? "All warranty checks passed. Likely eligible for a replacement." : "Ask for proof of purchase before deciding." });
      return "Thanks, " + first + ". " + (dev.battery_check ? "Your strap's battery check shows it " + dev.battery_check.toLowerCase() + ". " : "") +
        "Replacements are reviewed by our team, so I've passed this on with everything they need. They'll reply here.";
    }

    if (/\b(order|arrive|arrived|shipping|tracking|delivery)\b|so-\d+/.test(t)) {
      ctx.trace("think", "Intent: order status");
      var id = (text.match(/SO-\d+/i) || [m.orderId])[0];
      if (!id) { return "I couldn't find an order on your account. Could you share the order number? It starts with SO-."; }
      var o = await call("get_order_status", { order_id: id.toUpperCase() });
      return "Your order " + o.order_id + " shipped on Sep 23 and is held up at a regional carrier hub. It's now expected on " + o.expected_delivery + ". If it hasn't arrived by the day after, reply here and a person will help.";
    }

    if (/\b(sync|syncing|bluetooth|connect)\b/.test(t)) {
      ctx.trace("think", "Intent: sync problem");
      await call("get_device_status", { member_id: memberId });
      return "Some phone updates switch off Bluetooth access for the WHOOP app. Open Settings, then WHOOP, and turn Bluetooth on. Your strap should sync within a minute. If it doesn't, reply here and I'll bring in a person.";
    }

    ctx.trace("think", "Intent unclear. Hand to a person rather than guess.");
    await call("handoff_to_human", { queue: "rep", reason: "Unclear request", summary: first + ": " + text });
    return "Thanks, " + first + ". I want to make sure you get the right answer, so I've passed this to a member of the team. They'll reply here.";
  }

  window.SIM_AGENT = { respond: simulated };
})();
