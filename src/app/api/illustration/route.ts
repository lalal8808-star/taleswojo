import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export const maxDuration = 60; // Allow sufficient time for image generation

// Predefined Unsplash fallbacks mapping to align with page.tsx
const THEME_FALLBACKS: Record<string, string[]> = {
  space: [
    "https://images.unsplash.com/photo-1502134249126-9f3755a50d78?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80"
  ],
  forest: [
    "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=800&auto=format&fit=crop&q=80"
  ],
  toy: [
    "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1584824486509-112e4181ff6b?w=800&auto=format&fit=crop&q=80"
  ],
  sea: [
    "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80"
  ],
  default: [
    "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1559251606-c623743a6d76?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1502134249126-9f3755a50d78?w=800&auto=format&fit=crop&q=80"
  ]
};

// Map local GEMINI_API_KEY to standard GOOGLE_GENERATIVE_AI_API_KEY for Vercel AI SDK
if (process.env.GEMINI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const prompt = searchParams.get('prompt') || '';
  const indexStr = searchParams.get('index') || '0';
  const interest = (searchParams.get('interest') || '').toLowerCase();

  const index = parseInt(indexStr, 10) || 0;

  // Determine fallback Unsplash URL
  let themeKey: 'space' | 'forest' | 'toy' | 'sea' | 'default' = 'default';
  if (interest.includes('우주') || interest.includes('space') || interest.includes('별') || interest.includes('은하수')) {
    themeKey = 'space';
  } else if (interest.includes('숲') || interest.includes('동물') || interest.includes('공룡') || interest.includes('forest') || interest.includes('animal')) {
    themeKey = 'forest';
  } else if (interest.includes('방') || interest.includes('장난감') || interest.includes('toy') || interest.includes('집')) {
    themeKey = 'toy';
  } else if (interest.includes('바다') || interest.includes('섬') || interest.includes('물') || interest.includes('sea') || interest.includes('beach')) {
    themeKey = 'sea';
  }

  const fallbacks = THEME_FALLBACKS[themeKey];
  const fallbackUrl = fallbacks[index % fallbacks.length];

  if (!prompt || !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.warn('[Illustration API] Missing prompt or API key. Redirecting to fallback Unsplash.');
    return Response.redirect(fallbackUrl, 302);
  }

  try {
    console.log(`[Illustration API] Generating image via Google Gemini 3.1 Flash Image... Prompt: "${prompt}"`);
    
    // Generate image using multimodal Gemini 3.1 Flash Image model via generateText
    const result = await generateText({
      model: google('gemini-3.1-flash-image'),
      prompt: prompt,
    });

    const imageFiles = result.files?.filter((f) => f.mediaType?.startsWith('image/')) || [];
    
    if (imageFiles.length === 0) {
      throw new Error('No image was returned from the Gemini model.');
    }

    const uint8Array = imageFiles[0].uint8Array;
    const mediaType = imageFiles[0].mediaType || 'image/png';
    
    return new Response(uint8Array, {
      headers: {
        'Content-Type': mediaType,
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache heavily
      },
    });

  } catch (error: any) {
    console.error('[Illustration API] Google Imagen generation failed:', error.message || error);
    console.warn('[Illustration API] Redirecting client to Unsplash fallback URL.');
    
    // Smooth fallback to styled Unsplash image instead of throwing 500
    return Response.redirect(fallbackUrl, 302);
  }
}
