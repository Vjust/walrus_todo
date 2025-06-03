'use client';

import { useState } from 'react';
import Image from 'next/image';
import { walrusClient } from '@/lib/walrus-client';
import toast from 'react-hot-toast';

export default function WalrusStorageManager() {
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [blobId, setBlobId] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {return;}

    setIsUploading(true);
    setUploadStatus('Uploading to Walrus...');

    try {
      // Upload image to Walrus
      const result = await walrusClient.uploadImage(file, { epochs: 5 });

      setBlobId(result.blobId);
      const url = walrusClient.getBlobUrl(result.blobId);
      setImageUrl(url);

      setUploadStatus(`✅ Upload successful! Blob ID: ${result.blobId}`);
      toast.success('Image uploaded to Walrus successfully!', {
        duration: 4000,
        icon: '🖼️',
      });
      console.log('Upload result:', result);
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setUploadStatus(`❌ Upload failed: ${errorMessage}`);
      toast.error(`Upload failed: ${errorMessage}`, {
        duration: 5000,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleTextUpload = async () => {
    const text = prompt('Enter text to upload:');
    if (!text) {return;}

    setIsUploading(true);
    setUploadStatus('Uploading text to Walrus...');

    try {
      const result = await walrusClient.upload(text, {
        epochs: 5,
        contentType: 'text/plain',
      });

      setBlobId(result.blobId);
      setUploadStatus(`✅ Text uploaded! Blob ID: ${result.blobId}`);
      toast.success('Text uploaded to Walrus successfully!', {
        duration: 3000,
        icon: '📝',
      });

      // Test downloading it back
      const downloaded = await walrusClient.download(result.blobId);
      const downloadedText = new TextDecoder().decode(downloaded.data);
      console.log('Downloaded text:', downloadedText);
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setUploadStatus(`❌ Upload failed: ${errorMessage}`);
      toast.error(`Upload failed: ${errorMessage}`, {
        duration: 5000,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const testJsonUpload = async () => {
    const testData = {
      message: 'Hello from Walrus!',
      timestamp: new Date().toISOString(),
      data: {
        numbers: [1, 2, 3],
        nested: { key: 'value' },
      },
    };

    setIsUploading(true);
    setUploadStatus('Uploading JSON to Walrus...');

    try {
      const result = await walrusClient.uploadJson(testData, { epochs: 5 });

      setBlobId(result.blobId);
      setUploadStatus(`✅ JSON uploaded! Blob ID: ${result.blobId}`);
      toast.success('JSON data uploaded to Walrus successfully!', {
        duration: 3000,
        icon: '📦',
      });

      // Test downloading it back
      const downloaded = await walrusClient.downloadJson(result.blobId);
      console.log('Downloaded JSON:', downloaded);
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setUploadStatus(`❌ Upload failed: ${errorMessage}`);
      toast.error(`Upload failed: ${errorMessage}`, {
        duration: 5000,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className='ocean-card'>
      <h2 className='text-xl font-semibold mb-4'>Walrus Storage Manager</h2>

      <div className='space-y-4'>
        <div>
          <h3 className='font-medium mb-2'>Upload Image</h3>
          <input
            type='file'
            accept='image/*'
            onChange={handleImageUpload}
            disabled={isUploading}
            className='block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              disabled:opacity-50'
          />
        </div>

        <div className='flex gap-2'>
          <button
            onClick={handleTextUpload}
            disabled={isUploading}
            className='ocean-button'
          >
            Upload Text
          </button>

          <button
            onClick={testJsonUpload}
            disabled={isUploading}
            className='ocean-button'
          >
            Upload JSON
          </button>
        </div>

        {uploadStatus && (
          <div className='p-4 bg-gray-100 rounded'>
            <p className='text-sm'>{uploadStatus}</p>
          </div>
        )}

        {blobId && (
          <div className='p-4 bg-blue-50 rounded'>
            <p className='text-sm font-medium'>Blob ID:</p>
            <code className='text-xs break-all'>{blobId}</code>

            {imageUrl && (
              <div className='mt-4'>
                <p className='text-sm font-medium mb-2'>Uploaded Image:</p>
                <div className='relative max-w-xs'>
                  <Image
                    src={imageUrl}
                    alt='Uploaded to Walrus'
                    width={320}
                    height={240}
                    className='rounded shadow'
                    style={{ width: 'auto', height: 'auto' }}
                  />
                </div>
                <p className='text-xs mt-2'>
                  URL:{' '}
                  <a
                    href={imageUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-blue-600 underline'
                  >
                    {imageUrl}
                  </a>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
