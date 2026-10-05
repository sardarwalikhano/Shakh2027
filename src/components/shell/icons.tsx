import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const SearchIcon = (props: IconProps) => <Icon {...props}><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></Icon>;
export const HeartIcon = (props: IconProps) => <Icon {...props}><path d="M20.8 8.8c0 5-8.8 10.2-8.8 10.2S3.2 13.8 3.2 8.8a4.8 4.8 0 0 1 8-3.5l.8.8.8-.8a4.8 4.8 0 0 1 8 3.5Z"/></Icon>;
export const BellIcon = (props: IconProps) => <Icon {...props}><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M10 20h4"/></Icon>;
export const UserIcon = (props: IconProps) => <Icon {...props}><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-3.2 3.3-5 7-5s6.3 1.8 7 5"/></Icon>;
export const ChevronDownIcon = (props: IconProps) => <Icon {...props}><path d="m6 9 6 6 6-6"/></Icon>;
export const ChevronLeftIcon = (props: IconProps) => <Icon {...props}><path d="m14 6-6 6 6 6"/></Icon>;
export const HomeIcon = (props: IconProps) => <Icon {...props}><path d="m3 10 9-7 9 7"/><path d="M5 9.5V21h14V9.5M9.5 21v-6h5v6"/></Icon>;
export const GridIcon = (props: IconProps) => <Icon {...props}><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></Icon>;
export const ShoppingBagIcon = (props: IconProps) => <Icon {...props}><path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></Icon>;
export const MenuIcon = (props: IconProps) => <Icon {...props}><path d="M4 7h16M4 12h16M4 17h16"/></Icon>;
export const XIcon = (props: IconProps) => <Icon {...props}><path d="m6 6 12 12M18 6 6 18"/></Icon>;
export const MapPinIcon = (props: IconProps) => <Icon {...props}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></Icon>;
