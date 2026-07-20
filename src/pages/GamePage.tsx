import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import { NavBar } from '@/components/NavBar';
import { TravelMapScreen } from '@/components/screens/TravelMapScreen';
import { FriendsScreen } from '@/components/screens/FriendsScreen';
import { CityScreen } from '@/components/screens/CityScreen';
import { ShopScreen } from '@/components/screens/ShopScreen';
import { LeaderboardScreen } from '@/components/screens/LeaderboardScreen';
import { QRChestScreen } from '@/components/screens/QRChestScreen';
import { EpisodeScreen } from '@/components/screens/EpisodeScreen';
import { BottomActionBar } from '@/components/BottomActionBar';
import { SidebarTips } from '@/components/widgets/SidebarTips';
import { RewardsBar } from '@/components/widgets/RewardsBar';
import { SoftGateModal } from '@/components/SoftGateModal';
import { SoftGateController } from '@/components/SoftGateController';
import './GamePage.css';

export function GamePage() {
  const player = useGameStore((s) => s.player);
  const activeTab = useUIStore((s) => s.activeTab);
  const showEpisode = useUIStore((s) => s.showEpisode);
  const [difficulty, setDifficulty] = useState<'easy' | 'brave' | 'super'>('brave');

  if (!player) {
    return <div>Loading...</div>;
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
              {activeTab === 'friends' && <FriendsScreen />}
              {activeTab === 'city' && <CityScreen />}
              {activeTab === 'shop' && <ShopScreen />}
              {activeTab === 'leaderboard' && <LeaderboardScreen />}
              {activeTab === 'qr' && <QRChestScreen />}
            </div>
          ) : (
            <EpisodeScreen />
          )}
        </main>

        <aside className="sidebar-right">
          <RewardsBar />
        </aside>
      </div>

      <BottomActionBar difficulty={difficulty} setDifficulty={setDifficulty} />
    </div>
  );
}
