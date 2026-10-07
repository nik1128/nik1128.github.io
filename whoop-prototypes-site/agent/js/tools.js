/* The agent's tools. These are the ONLY actions the agent can take.
   There is deliberately no tool that moves money: no refunds, credits,
   discounts, waivers, price changes or free replacements. */
(function () {
  var D = window.DEMO;
  var caseCounter = 131200;

  function getMember(id) { return D.members[id] || null; }

  var TOOLS = {
    get_member: function (input) {
      var m = getMember(input.member_id);
      if (!m) return { error: "No member found with that ID." };
      return { member_id: input.member_id, name: m.name, tier: m.tier, renews: m.renews, months_left: m.monthsLeft,
        device: m.device, purchase_channel: m.purchaseChannel, membership_active: m.active, order_id: m.orderId };
    },

    get_device_status: function (input) {
      var m = getMember(input.member_id);
      if (!m) return { error: "No member found with that ID." };
      var out = { device: m.device, firmware: m.firmware, last_sync: m.lastSync, reported_lost: m.lost };
      if (m.batteryCheck) out.battery_check = m.batteryCheck;
      out.known_issues = ["Some phone OS updates switch off Bluetooth access for the WHOOP app. Fix: Settings > WHOOP > turn Bluetooth on."];
      return out;
    },

    get_order_status: function (input) {
      var o = D.orders[input.order_id];
      if (!o) return { error: "No order found with that number." };
      return { order_id: input.order_id, status: o.status, expected_delivery: o.expected, tracking: o.carrier };
    },

    check_policy: function (input) {
      var m = getMember(input.member_id);
      if (!m) return { error: "No member found with that ID." };
      var v = D.policyVersion, t = input.topic;
      if (t === "upgrade_to_life") {
        if (m.tier === "Life") return { policy_version: v, applies: false, answer: "Member is already on Life." };
        var credit = Math.floor(m.monthsLeft * 2 / 3);
        return { policy_version: v, applies: true,
          answer: "Remaining paid months move to Life at a 3:2 ratio: " + m.monthsLeft + " months of " + m.tier + " become " + credit + " months of Life credit. After that, Life renews at the standard price.",
          who_acts: "The member chooses and confirms the upgrade in the app. The agent explains it but cannot apply charges." };
      }
      if (t === "downgrade") {
        return { policy_version: v,
          answer: "A move to a lower tier starts at the end of the current billing period (" + m.renews + "). Unused time isn't refunded outside the first 30 days after purchase.",
          who_acts: "The member schedules it in the app, or a rep does it for them." };
      }
      if (t === "warranty") {
        var approved = D.approvedChannels.indexOf(m.purchaseChannel) > -1;
        var reasons = [
          (approved ? "Bought from WHOOP or an approved partner" : "Not bought from WHOOP or an approved partner"),
          (m.active ? "Membership active" : "Membership not active"),
          (m.paymentValid ? "Valid payment method on file" : "No valid payment method")
        ];
        var eligible = approved && m.active && m.paymentValid && !m.lost;
        return { policy_version: v, likely_eligible: eligible, checks: reasons,
          note: "Lost or stolen straps are not covered.",
          who_acts: "A replacement costs WHOOP money, so a rep reviews and creates the replacement order. The agent cannot promise one." };
      }
      if (t === "lost_or_stolen") {
        return { policy_version: v, covered: false,
          answer: "Lost or stolen straps aren't covered by the warranty. The member can buy a replacement and their membership carries over. A rep can lock the old strap to the account.",
          who_acts: "Any exception, such as a free replacement, is a money decision for a person." };
      }
      if (t === "refund") {
        return { policy_version: v,
          answer: "Refunds are generally only available within the first 30 days after purchase and need any unused devices returned. Anything else is an exception.",
          facts: { last_charge: m.lastCharge, cancellation_on_file: m.cancellationOnFile },
          who_acts: "ALL refund decisions are made by a person. The agent must not approve, promise or estimate a refund." };
      }
      return { error: "Unknown policy topic." };
    },

    handoff_to_human: function (input) {
      caseCounter += 1;
      var c = { case_number: "00" + caseCounter, queue: input.queue, reason: input.reason,
        summary: input.summary, recommendation: input.recommendation || "", created_in: "Service Cloud (simulated)" };
      if (window.onHandoff) window.onHandoff(c);
      return { created: true, case_number: c.case_number, queue: c.queue,
        tell_member: "A member of the team will reply in this chat." };
    }
  };

  // Tool definitions sent to Claude in "Claude API" mode.
  var SCHEMAS = [
    { name: "get_member", description: "Look up the signed-in member's membership: tier, renewal date, months left, device, purchase channel.",
      input_schema: { type: "object", properties: { member_id: { type: "string" } }, required: ["member_id"] } },
    { name: "get_device_status", description: "Get the member's strap status: firmware, last sync, battery check and known issues.",
      input_schema: { type: "object", properties: { member_id: { type: "string" } }, required: ["member_id"] } },
    { name: "get_order_status", description: "Get shipping status for an order number like SO-12345.",
      input_schema: { type: "object", properties: { order_id: { type: "string" } }, required: ["order_id"] } },
    { name: "check_policy", description: "Get WHOOP's official policy answer for this member. Always use this instead of answering policy questions from memory.",
      input_schema: { type: "object", properties: { member_id: { type: "string" },
        topic: { type: "string", enum: ["upgrade_to_life", "downgrade", "warranty", "lost_or_stolen", "refund"] } }, required: ["member_id", "topic"] } },
    { name: "handoff_to_human", description: "Create a Service Cloud case and hand the conversation to a person. Required for any refund, credit, discount, waiver, free replacement, warranty replacement, exception, cancellation risk, or anything you can't resolve.",
      input_schema: { type: "object", properties: {
        queue: { type: "string", enum: ["rep", "senior_rep", "retention", "health_specialist"] },
        reason: { type: "string" }, summary: { type: "string", description: "Short case summary for the rep." },
        recommendation: { type: "string", description: "Optional suggestion for the person. Never a decision." } },
        required: ["queue", "reason", "summary"] } }
  ];

  window.AGENT_TOOLS = { run: function (name, input) {
    if (!TOOLS[name]) return { error: "Tool not available to the agent: " + name };
    return TOOLS[name](input || {});
  }, schemas: SCHEMAS, names: Object.keys(TOOLS) };
})();
