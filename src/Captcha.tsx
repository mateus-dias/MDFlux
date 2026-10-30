import { useEffect, useRef } from "react";
export const captchaKey =
  (import.meta as any).env.VITE_TURNSTILE_SITE_KEY || "";
export default function Captcha({
  onToken,
  version,
}: {
  onToken: (s: string) => void;
  version: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!captchaKey) return;
    let id: string | undefined;
    let alive = true;
    const render = () => {
      if (alive && ref.current)
        id = (window as any).turnstile.render(ref.current, {
          sitekey: captchaKey,
          callback: onToken,
          "expired-callback": () => onToken(""),
          "error-callback": () => onToken(""),
        });
    };
    const s = document.createElement("script");
    if ((window as any).turnstile) render();
    else {
      s.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.onload = render;
      document.head.appendChild(s);
    }
    return () => {
      alive = false;
      if (id) (window as any).turnstile?.remove(id);
      s.remove();
    };
  }, [version]);
  return captchaKey ? <div className="captcha" ref={ref} /> : null;
}
