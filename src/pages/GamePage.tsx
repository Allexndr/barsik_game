import { lazy, Suspense } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import { NavBar } from '@/components/NavBar';
import { TravelMapScreen } from '@/components/screens/TravelMapScreen';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { SidebarTips } from '@/components/widgets/SidebarTips';
import { RewardsBar } from '@/components/widgets/RewardsBar';
import { SoftGateModal } from '@/components/SoftGateModal';
import { SoftGateController } from '@/components/SoftGateController';
import './GamePage.css';

// Keep Three.js out of the map's first route. Friends and Shop both create
// 3D previews, but most players enter the game on Travel first.
const FriendsScreen = lazy(() => import('@/components/screens/FriendsScreen').then((m) => ({ default: m.FriendsScreen })));
const ShopScreen = lazy(() => import('@/components/screens/ShopScreen').then((m) => ({ default: m.ShopScreen })));
const LeaderboardScreen = lazy(() => import('@/components/screens/LeaderboardScreen').then((m) => ({ default: m.LeaderboardScreen })));
const QRChestScreen = lazy(() => import('@/components/screens/QRChestScreen').then((m) => ({ default: m.QRChestScreen })));
const EpisodeScreen = lazy(() => import('@/components/screens/EpisodeScreen').then((m) => ({ default: m.EpisodeScreen })));

/** «Город» = Арбат-хаб с подлокациями и друзьями (не пустая поляна CityScreen). */
const HubScreen = lazy(() =>
  import('@/components/screens/HubScreen').then((module) => ({ default: module.HubScreen })),
);

export function GamePage() {
  const player = useGameStore((s) => s.player);
  const activeTab = useUIStore((s) => s.activeTab);
  const showEpisode = useUIStore((s) => s.showEpisode);

  if (!player) {
    return <div role="status">{useUIStore.getState().lang === 'kk' ? 'Жүктелуде…' : 'Загрузка…'}</div>;
  }

  return (
    <div className="game-page">
      <SoftGateController />
      <SoftGateModal />
      <NavBar />

      <div className="game-container">
        <aside className="sidebar-left">
          <SidebarTips />
        </aside>

        <main className="game-content">
          {!showEpisode ? (
            <div className="screens">
              {activeTab === 'travel' && <TravelMapScreen />}
              {activeTab === 'friends' && (
                <Suspense fallback={<LoadingOverlay />}><FriendsScreen /></Suspense>
              )}
              {activeTab === 'city' && (
                <Suspense fallback={<LoadingOverlay />}>
                  <HubScreen embedded />
                </Suspense>
              )}
              {activeTab === 'shop' && (
                <Suspense fallback={<LoadingOverlay />}><ShopScreen /></Suspense>
              )}
              {activeTab === 'leaderboard' && (
                <Suspense fallback={<LoadingOverlay />}><LeaderboardScreen /></Suspense>
              )}
              {activeTab === 'qr' && (
                <Suspense fallback={<LoadingOverlay />}><QRChestScreen /></Suspense>
              )}
            </div>
          ) : (
            <Suspense fallback={<LoadingOverlay />}><EpisodeScreen /></Suspense>
          )}
        </main>

        <aside className="sidebar-right">
          <RewardsBar />
        </aside>
      </div>
    </div>
  );
}
