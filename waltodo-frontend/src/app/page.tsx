import HomeContent from '@/components/HomeContent';
import { InitializationGuard } from '@/components/InitializationGuard';

export default function Home() {
  return (
    <InitializationGuard requireSuiClient showProgress>
      <HomeContent />
    </InitializationGuard>
  );
}