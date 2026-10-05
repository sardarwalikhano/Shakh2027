import { useEffect, useState } from 'react';

type InstallEvent = Event & { prompt?: () => Promise<void>; userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallEvent); };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    const isIosDevice = /iphone|ipad|ipod/i.test(navigator.userAgent) && !('MSStream' in window);
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    setIos(isIosDevice && !standalone);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  if ((!installEvent && !ios) || open === false) {
    if (!installEvent && !ios) return null;
    return <button type="button" onClick={() => setOpen(true)} className="fixed bottom-[92px] left-4 z-40 rounded-full border border-orange-200 bg-white px-4 py-2 text-[10px] font-black text-orange-700 shadow-lg lg:bottom-5 lg:left-5">دابەزاندنی ئەپ</button>;
  }

  async function install() {
    if (!installEvent?.prompt) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null); setOpen(false);
  }

  return <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-lg rounded-[24px] border border-slate-200 bg-white p-4 shadow-2xl lg:inset-x-auto lg:bottom-5 lg:left-5 lg:right-auto" dir="rtl"><div className="flex items-start gap-3"><img src="/brand/shakh-logo.jpg" alt="شاخ" className="h-12 w-12 rounded-2xl object-contain" /><div className="min-w-0 flex-1"><strong className="block text-sm font-black text-slate-950">SHAKH وەک ئەپ دابەزێنە</strong><p className="mt-1 text-xs leading-6 text-slate-500">بۆ مۆبایل، تابلێت و desktop دەتوانیت وەک ئەپی سەربەخۆ بەکاری بهێنیت.</p>{ios && <p className="mt-2 text-[10px] font-bold text-slate-600">لە iPhone/iPad: Share بکە و <b>Add to Home Screen</b> هەڵبژێرە.</p>}</div><button type="button" className="shakh-icon-button" onClick={() => setOpen(false)} aria-label="داخستن">×</button></div><div className="mt-3 flex justify-end gap-2">{installEvent && <button type="button" className="shakh-btn-primary" onClick={() => void install()}>دابەزاندن</button>}<button type="button" className="shakh-ghost-btn" onClick={() => setOpen(false)}>لە ئێستا نا</button></div></div>;
}
