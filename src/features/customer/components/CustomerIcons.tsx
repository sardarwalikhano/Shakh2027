import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const ArrowLeftIcon = (props: IconProps) => <Icon {...props}><path d="M15 6 9 12l6 6" /></Icon>;
export const BellRingIcon = (props: IconProps) => <Icon {...props}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" /><path d="M10 20h4" /><path d="m17 3 2 2" /><path d="m7 3-2 2" /></Icon>;
export const CheckCircleIcon = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="8" /><path d="m8.8 12.2 2.1 2.1 4.6-4.8" /></Icon>;
export const ClipboardIcon = (props: IconProps) => <Icon {...props}><rect x="6" y="5" width="12" height="15" rx="2" /><path d="M9 5.2V4h6v1.2M9 10h6M9 14h4" /></Icon>;
export const CoinIcon = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="8" /><path d="M12 8v8M9.5 10.2c.7-.9 1.6-1.3 2.8-1.3 1.4 0 2.4.7 2.4 1.7 0 2.4-5.2 1.2-5.2 3.5 0 1.1 1 1.8 2.5 1.8 1.1 0 2.1-.4 2.8-1.3" /></Icon>;
export const GiftIcon = (props: IconProps) => <Icon {...props}><path d="M4 10h16v10H4z" /><path d="M3 10h18M12 10v10" /><path d="M12 10H7.8A2.8 2.8 0 1 1 10 7.2L12 10Z" /><path d="M12 10h4.2A2.8 2.8 0 1 0 14 7.2L12 10Z" /></Icon>;
export const HeartFillIcon = (props: IconProps) => <Icon {...props}><path d="M20.8 8.8c0 5-8.8 10.2-8.8 10.2S3.2 13.8 3.2 8.8a4.8 4.8 0 0 1 8-3.5l.8.8.8-.8a4.8 4.8 0 0 1 8 3.5Z" /></Icon>;
export const LogOutIcon = (props: IconProps) => <Icon {...props}><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" /><path d="m15 16 4-4-4-4M19 12H9" /></Icon>;
export const SettingsIcon = (props: IconProps) => <Icon {...props}><path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" /><path d="m19.4 15 .2.1a1.8 1.8 0 0 1-1 3.2l-.3-.1-1.2.7-.1.3a1.8 1.8 0 0 1-3.4 0l-.1-.3-1.5-.1-1.5.1-.1.3a1.8 1.8 0 0 1-3.4 0l-.1-.3-1.2-.7-.3.1a1.8 1.8 0 0 1-1-3.2l.2-.1.1-1.5-.1-1.5-.2-.1a1.8 1.8 0 0 1 1-3.2l.3.1 1.2-.7.1-.3a1.8 1.8 0 0 1 3.4 0l.1.3 1.5.1 1.5-.1.1-.3a1.8 1.8 0 0 1 3.4 0l.1.3 1.2.7.3-.1a1.8 1.8 0 0 1 1 3.2l-.2.1-.1 1.5.1 1.5Z" /></Icon>;
export const ShareIcon = (props: IconProps) => <Icon {...props}><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.3 11 7.4-4.2M8.3 13l7.4 4.2" /></Icon>;
export const StarIcon = (props: IconProps) => <Icon {...props}><path d="m12 4 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8L12 4Z" /></Icon>;
export const UserIcon = (props: IconProps) => <Icon {...props}><circle cx="12" cy="8" r="3" /><path d="M5 20a7 7 0 0 1 14 0" /></Icon>;
export const WalletIcon = (props: IconProps) => <Icon {...props}><path d="M4 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" /><path d="M4 8h15M15 14h4" /><circle cx="15" cy="14" r=".6" fill="currentColor" /></Icon>;
