'use client';

import CreateTodoNFTForm from '@/components/CreateTodoNFTForm';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Todo } from '@/types/todo-nft';

export default function CreateNFTPage() {
  const router = useRouter();
  const [createdTodo, setCreatedTodo] = useState<Todo | null>(null);

  const handleTodoCreated = (todo: Todo) => {
    setCreatedTodo(todo);
    // Optionally redirect after a delay
    setTimeout(() => {
      router.push('/dashboard');
    }, 3000);
  };

  const handleCancel = () => {
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-ocean-lightest to-white dark:from-ocean-darkest dark:to-ocean-dark">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-ocean-deep dark:text-ocean-light mb-2">
            Create Your Todo NFT
          </h1>
          <p className="text-ocean-medium dark:text-ocean-light/80">
            Transform your tasks into unique NFTs on the Sui blockchain
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          {!createdTodo ? (
            <div className="bg-white dark:bg-ocean-darkest rounded-xl shadow-xl p-6 md:p-8">
              <CreateTodoNFTForm
                listName="My Tasks"
                onTodoCreated={handleTodoCreated}
                onCancel={handleCancel}
              />
            </div>
          ) : (
            // Success Message
            <div className="bg-white dark:bg-ocean-darkest rounded-xl shadow-xl p-8 text-center">
              <div className="mb-6">
                <svg
                  className="w-24 h-24 mx-auto text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-ocean-deep dark:text-ocean-light mb-4">
                Todo NFT Created Successfully!
              </h2>
              <div className="space-y-2 text-ocean-medium dark:text-ocean-light/80">
                <p>
                  <span className="font-medium">Title:</span> {createdTodo.title}
                </p>
                {createdTodo.objectId && (
                  <p>
                    <span className="font-medium">NFT ID:</span>{' '}
                    <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {createdTodo.objectId}
                    </code>
                  </p>
                )}
                {createdTodo.walrusBlobId && (
                  <p>
                    <span className="font-medium">Walrus Blob ID:</span>{' '}
                    <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {createdTodo.walrusBlobId}
                    </code>
                  </p>
                )}
              </div>
              <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
                Redirecting to dashboard in 3 seconds...
              </p>
            </div>
          )}
        </div>

        {/* Features Info */}
        <div className="max-w-4xl mx-auto mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/80 dark:bg-ocean-darkest/80 backdrop-blur rounded-lg p-6">
            <div className="w-12 h-12 bg-ocean-light/20 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-ocean-deep dark:text-ocean-light"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-ocean-deep dark:text-ocean-light mb-2">
              Custom Images
            </h3>
            <p className="text-sm text-ocean-medium dark:text-ocean-light/70">
              Upload and compress images automatically for your NFT artwork
            </p>
          </div>

          <div className="bg-white/80 dark:bg-ocean-darkest/80 backdrop-blur rounded-lg p-6">
            <div className="w-12 h-12 bg-ocean-light/20 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-ocean-deep dark:text-ocean-light"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-ocean-deep dark:text-ocean-light mb-2">
              Cost Estimation
            </h3>
            <p className="text-sm text-ocean-medium dark:text-ocean-light/70">
              See storage costs on Walrus before creating your NFT
            </p>
          </div>

          <div className="bg-white/80 dark:bg-ocean-darkest/80 backdrop-blur rounded-lg p-6">
            <div className="w-12 h-12 bg-ocean-light/20 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-ocean-deep dark:text-ocean-light"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-ocean-deep dark:text-ocean-light mb-2">
              Privacy Options
            </h3>
            <p className="text-sm text-ocean-medium dark:text-ocean-light/70">
              Create private NFTs that only you can view and manage
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}