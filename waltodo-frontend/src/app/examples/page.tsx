import Navbar from '@/components/navbar';
import WalletUsageExample from './wallet-usage';

export default function ExamplesPage() {
  return (
    <>
      <Navbar currentPage="examples" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-ocean-deep dark:text-ocean-foam mb-8">
          Code Examples
        </h1>
        
        <div className="grid gap-8">
          <div className="ocean-card">
            <WalletUsageExample />
          </div>
        </div>
      </div>
    </>
  );
}