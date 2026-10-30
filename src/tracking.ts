import { endpoint } from "./api";
const allowed = [
  "PageView",
  "ViewContent",
  "Lead",
  "CompleteRegistration",
  "StartTrial",
  "InitiateCheckout",
];
export function track(event: string, custom: any = {}) {
  if (
    localStorage.getItem("mdflux:consent") !== "yes" ||
    !allowed.includes(event)
  )
    return;
  const id = crypto.randomUUID();
  const fb = (window as any).fbq;
  fb?.("track", event, custom, { eventID: id });
  endpoint("events", { event, id, custom }).catch(() => {});
}
export function consent(value: boolean) {
  localStorage.setItem("mdflux:consent", value ? "yes" : "no");
  if (value) {
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
      q("init", pixel);
    }
    track("PageView");
  } else (window as any).fbq?.("consent", "revoke");
}
