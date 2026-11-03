import { endpoint } from "./api";
const allowed = [
  "PageView",
  "ViewContent",
  "Lead",
  "CompleteRegistration",
  "StartTrial",
  "InitiateCheckout",
];
function publicMeasurementPage() {
  return location.pathname === "/" &&
    !/[?&#](access_token|refresh_token|token_hash|code)=/i.test(location.search + location.hash);
}
export function track(event: string, custom: any = {}) {
  if (
    localStorage.getItem("mdflux:consent") !== "yes" ||
    !allowed.includes(event)
  )
    return;
  const id = crypto.randomUUID();
  const fb = (window as any).fbq;
  if (publicMeasurementPage()) fb?.("track", event, custom, { eventID: id });
  endpoint("events", { event, id, custom }).catch(() => {});
}
export function consent(value: boolean) {
  localStorage.setItem("mdflux:consent", value ? "yes" : "no");
  if (value) {
    if (!publicMeasurementPage()) return;
    const pixel = (import.meta as any).env.VITE_META_PIXEL_ID;
    if (pixel && /^\d+$/.test(pixel) && !(window as any).fbq) {
      const q: any = function (...args: any[]) {
        q.callMethod ? q.callMethod(...args) : q.queue.push(args);
      };
      q.queue = [];
      q.loaded = true;
      q.version = "2.0";
      (window as any).fbq = q;
      const s = document.createElement("script");
      s.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(s);
      q("set", "autoConfig", false, pixel);
      q("init", pixel);
    }
    (window as any).fbq?.("consent", "grant");
    track("PageView");
  } else (window as any).fbq?.("consent", "revoke");
}
