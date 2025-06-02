'use client';

export default function TestPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">🧪 Basic Test Page</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-semibold mb-4">✅ Frontend Working</h2>
        <p className="text-gray-600 mb-4">
          This minimal page confirms that:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>Next.js is running correctly</li>
          <li>Tailwind CSS is working</li>
          <li>No webpack import errors</li>
          <li>Basic React components load</li>
        </ul>
        
        <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded">
          <p className="text-green-800 font-medium">
            🎉 Basic frontend architecture is working!
          </p>
          <p className="text-green-600 text-sm mt-1">
            Now we can gradually add the blockchain components back.
          </p>
        </div>
      </div>
    </div>
  );
}