export const customerStatuses = {
  exempt: "Conta administrativa",
  trial: "Em teste grátis",
  trial_ended: "Teste encerrado · sem assinatura vigente",
  active: "Assinatura em dia",
  due_soon: "Vence em até 7 dias",
  canceled: "Cancelada · acesso até o vencimento",
  overdue: "Assinatura vencida",
  suspended: "Suspensa",
  unknown: "Sem assinatura registrada",
};
export function customerStatus(s, now = Date.now(), exempt = false) {
  if (exempt) return "exempt";
  if (!s) return "unknown";
  if (s.suspended) return "suspended";
  if (
    ["active", "canceled"].includes(s.status) &&
    Date.parse(s.paid_until) > now
  ) {
    if (s.status === "canceled") return "canceled";
    return Date.parse(s.paid_until) - now <= 7 * 86400000
      ? "due_soon"
      : "active";
  }
  if (s.status === "trialing" && Date.parse(s.trial_end) > now) return "trial";
  if (["trialing", "trial_expired", "expired"].includes(s.status))
    return "trial_ended";
  if (["active", "past_due", "canceled"].includes(s.status)) return "overdue";
  return "unknown";
}

export function contactNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  // Local Brazilian numbers need the country code for wa.me.
  const full =
    digits.length === 10 || digits.length === 11 ? "55" + digits : digits;
  return full.length >= 12 && full.length <= 15 ? full : null;
}
