/* Guardrails enforced in code, not just in the prompt.
   The model can be talked into things. Code can't. */
(function () {
  var HEALTH = /\b(blood pressure|bp insight|ecg|afib|a-fib|irregular (heart|rhythm)|heart rhythm|palpitation|arrhythmia|symptom|medication|diagnos|doctor|my heart)\b/i;
  var URGENT = /\b(chest pain|can'?t breathe|shortness of breath|short of breath|fainted|passed out|severe headache|numbness|stroke|heart attack)\b/i;
  var MONEY_REQUEST = /\b(refund|money back|reimburse|compensat|credit|discount|waive|free (replacement|one|strap)|for free|exception|charged|charge me|overcharged)\b/i;
  var INJECTION = /\b(ignore (all |your |the )?(previous |prior )?(rules|instructions)|you('| a)re authori[sz]ed|developer mode|system prompt|pretend you)\b/i;

  // Phrases that would commit WHOOP to spending or returning money.
  var COMMITMENTS = [
    /\b(i|we)('ve| have| will|'ll)?\s+(issued|processed|approved|refunded|credited|waived|applied (a |the )?(credit|discount|refund))/i,
    /\b(i|we)('ll| will| can| am going to| are going to)\s+(issue|process|approve|give you|send you)\s+(a |the |your )?(full |partial )?(refund|credit|discount|reimbursement)/i,
    /\byou('ll| will)\s+(get|receive|be getting)\s+(a |the |your )?(full |partial )?(refund|credit|reimbursement|free)/i,
    /\b(refund|credit|reimbursement)\s+(has been|is|was)\s+(issued|approved|processed|on its way)/i,
    /\b(i|we)('ll| will| can)\s+send you a (free|new|replacement) strap/i,
    /\bat no (extra )?cost to you\b/i
  ];

  window.GUARDRAILS = {
    health: function (text) { return { sensitive: HEALTH.test(text) || URGENT.test(text), urgent: URGENT.test(text) }; },
    moneyRequest: function (text) { return MONEY_REQUEST.test(text); },
    injection: function (text) { return INJECTION.test(text); },
    monetaryCommitment: function (text) {
      for (var i = 0; i < COMMITMENTS.length; i++) { var m = text.match(COMMITMENTS[i]); if (m) return m[0]; }
      return null;
    },
    EMERGENCY_TEXT: "If you have chest pain, trouble breathing, fainting or a severe headache, please call your local emergency number now. I'm not able to give medical advice, and I've asked our health specialist team to reach out to you here.",
    HEALTH_TEXT: "Thanks for telling me. Questions about your health readings are handled by our health specialist team, not by me. I've passed this on and someone will reply in this chat. If anything feels urgent, like chest pain or trouble breathing, please call your local emergency number.",
    BLOCKED_TEXT: "I can't make decisions about refunds, credits or other payments, but I've passed your request to a member of the team who can. They'll reply in this chat.",
    CANNOT_DO: [
      "Approve, promise or estimate refunds",
      "Apply credits, discounts or waive fees",
      "Change prices or charge a card",
      "Send free or warranty replacements",
      "Make exceptions to policy",
      "Answer questions about health readings"
    ]
  };
})();
