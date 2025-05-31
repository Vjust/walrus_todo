import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Handle shared files (images)
      const formData = await request.formData();
      const title = formData.get('title') as string || 'Shared Content';
      const text = formData.get('text') as string || '';
      const url = formData.get('url') as string || '';
      const files = formData.getAll('image') as File[];
      
      if (files.length > 0) {
        // Process shared images
        const file = files[0];
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        // Here you would typically:
        // 1. Save the image temporarily
        // 2. Create a new todo with the image
        // 3. Upload to Walrus
        // 4. Create NFT if needed
        
        console.log('[Share Target] Received image:', {
          name: file.name,
          size: file.size,
          type: file.type,
          title,
          text
        });
        
        // Redirect to the blockchain page with action
        return NextResponse.redirect(
          new URL(`/blockchain?action=create-nft&shared=true&title=${encodeURIComponent(title)}`, request.url)
        );
      }
    } else {
      // Handle text/URL shares
      const data = await request.json();
      const { title, text, url } = data;
      
      console.log('[Share Target] Received data:', { title, text, url });
      
      // Redirect to home page with action
      return NextResponse.redirect(
        new URL(`/?action=add-task&title=${encodeURIComponent(title || text || '')}&url=${encodeURIComponent(url || '')}`, request.url)
      );
    }
    
    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('[Share Target] Error:', error);
    return NextResponse.redirect(new URL('/?error=share-failed', request.url));
  }
}

export async function GET(request: NextRequest) {
  // Handle GET requests (fallback)
  const searchParams = request.nextUrl.searchParams;
  const title = searchParams.get('title') || '';
  const text = searchParams.get('text') || '';
  const url = searchParams.get('url') || '';
  
  console.log('[Share Target] GET request:', { title, text, url });
  
  return NextResponse.redirect(
    new URL(`/?action=add-task&title=${encodeURIComponent(title || text || '')}&url=${encodeURIComponent(url || '')}`, request.url)
  );
}