import AppShell from "../../components/shell/AppShell";
import CategoryRail from "./components/CategoryRail";
import DiscoveryHero from "./components/DiscoveryHero";
import LiveFeedRail from "./components/LiveFeedRail";
import PromoMosaic from "./components/PromoMosaic";
import TrustStrip from "./components/TrustStrip";

export default function HomePage() {
  return (
    <AppShell>
      <main className="space-y-8 lg:space-y-10" aria-label="SHAKH home">
        <DiscoveryHero />
        <CategoryRail />
        <PromoMosaic />
        <LiveFeedRail />
        <TrustStrip />
      </main>
    </AppShell>
  );
}
