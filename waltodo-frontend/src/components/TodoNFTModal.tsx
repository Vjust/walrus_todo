'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { AlertCircle, Check, Clock, Copy, DollarSign, Download, Edit2, Facebook, Info, Link, Maximize2, Minimize2, Send, Share2, Twitter, X } from 'lucide-react'
import { TodoNFT } from '@/types/todo-nft'
import { useWalletContext } from '@/contexts/WalletContext'
import { toast } from 'react-hot-toast'
import { isValidSuiAddress } from '@mysten/sui/utils'

interface TodoNFTModalProps {
  nft: TodoNFT | null
  isOpen: boolean
  onClose: () => void
  onTransfer?: (nftId: string, recipientAddress: string) => Promise<void>
  onUpdateMetadata?: (nftId: string, metadata: Partial<TodoNFT>) => Promise<void>
}

interface TransactionHistory {
  id: string
  type: 'transfer' | 'mint' | 'metadata_update'
  from: string
  to?: string
  timestamp: string
  txHash: string
}

export default function TodoNFTModal({ 
  nft, 
  isOpen, 
  onClose, 
  onTransfer,
  onUpdateMetadata 
}: TodoNFTModalProps) {
  const walletContext = useWalletContext();
  const { address } = walletContext || { address: null };
  const modalRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  
  // State
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'transfer'>('details')
  const [isImageZoomed, setIsImageZoomed] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [transferAddress, setTransferAddress] = useState('')
  const [isTransferring, setIsTransferring] = useState(false)
  const [editedMetadata, setEditedMetadata] = useState<Partial<TodoNFT>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [imageZoomLevel, setImageZoomLevel] = useState(1)
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Mock transaction history (in real app, fetch from blockchain)
  const transactionHistory: TransactionHistory[] = [
    {
      id: '1',
      type: 'mint',
      from: 'System', // Default since TodoNFT doesn't have creator field
      timestamp: nft?.createdAt ? new Date(nft.createdAt * 1000).toISOString() : new Date().toISOString(),
      txHash: '0x123...abc'
    }
  ]

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('details')
      setIsImageZoomed(false)
      setIsEditing(false)
      setTransferAddress('')
      setEditedMetadata({})
      setImageZoomLevel(1)
      setImagePosition({ x: 0, y: 0 })
    }
  }, [isOpen])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) {return}

      switch (e.key) {
        case 'Escape':
          if (isImageZoomed) {
            setIsImageZoomed(false)
          } else {
            onClose()
          }
          break
        case 'Tab':
          if (e.shiftKey) {
            // Navigate backwards through tabs
            setActiveTab(prev => 
              prev === 'details' ? 'transfer' : 
              prev === 'history' ? 'details' : 
              'history'
            )
          } else {
            // Navigate forwards through tabs
            setActiveTab(prev => 
              prev === 'details' ? 'history' : 
              prev === 'history' ? 'transfer' : 
              'details'
            )
          }
          e.preventDefault()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isImageZoomed, onClose])

  // Image zoom controls
  const handleImageZoom = useCallback((e: React.WheelEvent) => {
    if (!isImageZoomed) {return}
    
    e.preventDefault()
    const delta = e.deltaY * -0.01
    const newZoom = Math.min(Math.max(1, imageZoomLevel + delta), 3)
    setImageZoomLevel(newZoom)
  }, [isImageZoomed, imageZoomLevel])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isImageZoomed || imageZoomLevel <= 1) {return}
    
    setIsDragging(true)
    setDragStart({
      x: e.clientX - imagePosition.x,
      y: e.clientY - imagePosition.y
    })
  }, [isImageZoomed, imageZoomLevel, imagePosition])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) {return}
    
    setImagePosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }, [isDragging, dragStart])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Transfer functionality
  const handleTransfer = async () => {
    if (!nft || !onTransfer) {return}

    if (!isValidSuiAddress(transferAddress)) {
      toast.error('Please enter a valid Sui address')
      return
    }

    if (transferAddress === address) {
      toast.error('Cannot transfer to yourself')
      return
    }

    setIsTransferring(true)
    try {
      await onTransfer(nft.id, transferAddress)
      toast.success('NFT transferred successfully!')
      onClose()
    } catch (error) {
      toast.error('Failed to transfer NFT')
      console.error('Transfer error:', error)
    } finally {
      setIsTransferring(false)
    }
  }

  // Save metadata
  const handleSaveMetadata = async () => {
    if (!nft || !onUpdateMetadata || Object.keys(editedMetadata).length === 0) {return}

    setIsSaving(true)
    try {
      await onUpdateMetadata(nft.id, editedMetadata)
      toast.success('Metadata updated successfully!')
      setIsEditing(false)
      setEditedMetadata({})
    } catch (error) {
      toast.error('Failed to update metadata')
      console.error('Update error:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Copy link
  const copyLink = () => {
    const link = `${window.location.origin}/nft/${nft?.id}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    toast.success('Link copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  // Download image
  const downloadImage = () => {
    // TODO: Implement image download when image URL field is available
    toast.error('Image download not available for this NFT type')
  }

  // Share to social media
  const shareToTwitter = () => {
    const text = `Check out my Todo NFT: ${nft?.title}`
    const url = `${window.location.origin}/nft/${nft?.id}`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank')
  }

  const shareToFacebook = () => {
    const url = `${window.location.origin}/nft/${nft?.id}`
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank')
  }

  if (!isOpen || !nft) {return null}

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          ref={modalRef}
          className="relative w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl transform transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b dark:border-gray-800">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {nft.title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex flex-col lg:flex-row">
            {/* Image Section */}
            <div className="lg:w-1/2 p-6 border-r dark:border-gray-800">
              <div className="relative group">
                <Image
                  ref={imageRef}
                  src="/images/nft-placeholder.png"
                  alt={nft.title}
                  width={400}
                  height={400}
                  className={`w-full rounded-lg transition-all ${
                    isImageZoomed ? 'cursor-move' : 'cursor-zoom-in'
                  }`}
                  style={isImageZoomed ? {
                    transform: `scale(${imageZoomLevel}) translate(${imagePosition.x / imageZoomLevel}px, ${imagePosition.y / imageZoomLevel}px)`,
                    transformOrigin: 'center'
                  } : {}}
                  onClick={() => !isImageZoomed && setIsImageZoomed(true)}
                  onWheel={handleImageZoom}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  draggable={false}
                  sizes="(max-width: 1024px) 100vw, 400px"
                  priority
                />
                
                {/* Image Controls */}
                <div className="absolute top-4 right-4 flex gap-2">
                  <button
                    onClick={() => setIsImageZoomed(!isImageZoomed)}
                    className="p-2 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow-lg hover:bg-white dark:hover:bg-gray-800 transition-colors"
                    aria-label={isImageZoomed ? "Exit fullscreen" : "Enter fullscreen"}
                  >
                    {isImageZoomed ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={downloadImage}
                    className="p-2 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow-lg hover:bg-white dark:hover:bg-gray-800 transition-colors"
                    aria-label="Download image"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
                
                {isImageZoomed && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                    {Math.round(imageZoomLevel * 100)}%
                  </div>
                )}
              </div>

              {/* Share Buttons */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={copyLink}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Link className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
                <button
                  onClick={shareToTwitter}
                  className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Share on Twitter"
                >
                  <Twitter className="w-4 h-4" />
                </button>
                <button
                  onClick={shareToFacebook}
                  className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Share on Facebook"
                >
                  <Facebook className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Details Section */}
            <div className="lg:w-1/2 p-6">
              {/* Tabs */}
              <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-6">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
                    activeTab === 'details'
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Details
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
                    activeTab === 'history'
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  History
                </button>
                <button
                  onClick={() => setActiveTab('transfer')}
                  className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
                    activeTab === 'transfer'
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Transfer
                </button>
              </div>

              {/* Tab Content */}
              <div className="space-y-4">
                {activeTab === 'details' && (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">NFT Details</h3>
                      {address && ( // Simplified check - show edit button if wallet is connected
                        <button
                          onClick={() => setIsEditing(!isEditing)}
                          className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                          aria-label="Edit metadata"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {/* Title */}
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Title</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editedMetadata.title ?? nft.title}
                            onChange={(e) => setEditedMetadata({ ...editedMetadata, title: e.target.value })}
                            className="mt-1 w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                          />
                        ) : (
                          <p className="mt-1 text-gray-900 dark:text-white">{nft.title}</p>
                        )}
                      </div>

                      {/* Description */}
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Description</label>
                        {isEditing ? (
                          <textarea
                            value={editedMetadata.content ?? nft.content}
                            onChange={(e) => setEditedMetadata({ ...editedMetadata, content: e.target.value })}
                            className="mt-1 w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                            rows={3}
                          />
                        ) : (
                          <p className="mt-1 text-gray-900 dark:text-white">{nft.content}</p>
                        )}
                      </div>

                      {/* Token ID */}
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Token ID</label>
                        <p className="mt-1 font-mono text-sm text-gray-900 dark:text-white break-all">{nft.id}</p>
                      </div>

                      {/* Owner */}
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Owner</label>
                        <p className="mt-1 font-mono text-sm text-gray-900 dark:text-white break-all">
                          {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Unknown'}
                        </p>
                      </div>

                      {/* Creator */}
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Creator</label>
                        <p className="mt-1 font-mono text-sm text-gray-900 dark:text-white break-all">
                          System
                        </p>
                      </div>

                      {/* Market Value */}
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          Estimated Value
                        </label>
                        <p className="mt-1 text-gray-900 dark:text-white">
                          Not available
                        </p>
                      </div>

                      {/* Created Date */}
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Created
                        </label>
                        <p className="mt-1 text-gray-900 dark:text-white">
                          {new Date(nft.createdAt * 1000).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>

                      {/* Tags */}
                      {nft.tags && nft.tags.length > 0 && (
                        <div>
                          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Tags</label>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {nft.tags.map((tag, index) => (
                              <span key={index} className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full text-xs">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Save Button */}
                    {isEditing && (
                      <div className="flex gap-2 mt-6">
                        <button
                          onClick={handleSaveMetadata}
                          disabled={isSaving || Object.keys(editedMetadata).length === 0}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          onClick={() => {
                            setIsEditing(false)
                            setEditedMetadata({})
                          }}
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'history' && (
                  <>
                    <h3 className="text-lg font-semibold mb-4">Transaction History</h3>
                    <div className="space-y-3">
                      {transactionHistory.map((tx) => (
                        <div key={tx.id} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {tx.type === 'mint' && 'Minted'}
                              {tx.type === 'transfer' && 'Transferred'}
                              {tx.type === 'metadata_update' && 'Metadata Updated'}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(tx.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              From: <span className="font-mono">{tx.from.slice(0, 6)}...{tx.from.slice(-4)}</span>
                            </p>
                            {tx.to && (
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                To: <span className="font-mono">{tx.to.slice(0, 6)}...{tx.to.slice(-4)}</span>
                              </p>
                            )}
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Tx: <span className="font-mono">{tx.txHash}</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {activeTab === 'transfer' && (
                  <>
                    <h3 className="text-lg font-semibold mb-4">Transfer NFT</h3>
                    {address ? ( // Show transfer options if wallet is connected
                      <div className="space-y-4">
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                Important: This action cannot be undone
                              </p>
                              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                Make sure you have the correct recipient address before proceeding.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Recipient Address
                          </label>
                          <input
                            type="text"
                            value={transferAddress}
                            onChange={(e) => setTransferAddress(e.target.value)}
                            placeholder="0x..."
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          {transferAddress && !isValidSuiAddress(transferAddress) && (
                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                              Please enter a valid Sui address
                            </p>
                          )}
                        </div>

                        <button
                          onClick={handleTransfer}
                          disabled={!transferAddress || !isValidSuiAddress(transferAddress) || isTransferring}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Send className="w-4 h-4" />
                          {isTransferring ? 'Transferring...' : 'Transfer NFT'}
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Info className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 dark:text-gray-400">
                          You don't own this NFT and cannot transfer it.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}