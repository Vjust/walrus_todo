export default function About() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-ocean-foam to-ocean-light p-4">
      <div className="max-w-4xl mx-auto">
        <div className="glass-card p-8 rounded-2xl">
          <h1 className="text-4xl font-bold text-ocean-deep mb-6">
            About Walrus Todo
          </h1>
          
          <div className="prose prose-ocean max-w-none">
            <p className="text-lg text-ocean-deep mb-4">
              Walrus Todo is a next-generation Web3 task management application that combines the power of blockchain technology with beautiful, intuitive design.
            </p>
            
            <h2 className="text-2xl font-semibold text-ocean-deep mt-8 mb-4">Features</h2>
            <ul className="list-disc list-inside text-ocean-deep space-y-2">
              <li>Decentralized storage using Walrus Protocol</li>
              <li>NFT-based todos on Sui blockchain</li>
              <li>Beautiful oceanic design with glass-morphism effects</li>
              <li>Multi-wallet support (Sui, Phantom, Slush, Backpack)</li>
              <li>Automatic port detection for development</li>
              <li>Comprehensive error handling</li>
            </ul>
            
            <h2 className="text-2xl font-semibold text-ocean-deep mt-8 mb-4">Technology Stack</h2>
            <ul className="list-disc list-inside text-ocean-deep space-y-2">
              <li>Next.js 15 with App Router</li>
              <li>React 18 with TypeScript</li>
              <li>Tailwind CSS for styling</li>
              <li>Sui blockchain integration</li>
              <li>Walrus decentralized storage</li>
              <li>Multiple wallet adapters</li>
            </ul>
            
            <h2 className="text-2xl font-semibold text-ocean-deep mt-8 mb-4">Built With</h2>
            <p className="text-ocean-deep">
              This application demonstrates the future of decentralized task management, 
              where your data is truly yours and stored on the blockchain for permanence and transparency.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}