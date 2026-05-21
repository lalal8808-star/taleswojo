import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// Next.js Route segment config
export const maxDuration = 30; // Limit execution to standard API window

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get('text');
    const voice = searchParams.get('voice') || 'ko-KR-SunHiNeural'; // Default cozy mother voice

    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Text parameter is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Initialize the MS Edge TTS Client
    const tts = new MsEdgeTTS();
    
    // Configure with standard high-quality MP3 format (24khz, 48kbps mono is perfectly clean and extremely fast to load)
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    // Simple SSML XML escaping to prevent raw tag injection issues
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    // Acquire the readable audio stream
    const { audioStream } = tts.toStream(escapedText);

    // Build standard Web ReadableStream for seamless client-side streaming response
    const stream = new ReadableStream({
      start(controller) {
        audioStream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        audioStream.on('end', () => {
          controller.close();
        });
        audioStream.on('error', (err) => {
          controller.error(err);
        });
      },
    });

    // Return fluid MP3 file response with generous client caching (1 year cache control)
    // Cache is uniquely mapped by the exact text query string and voice selected, preventing redundant API cost!
    return new Response(stream, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error('[Edge TTS API Error]:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to synthesize speech via Edge TTS.',
        details: error.message 
      }), 
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
