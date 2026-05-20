import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';

export const maxDuration = 120; // Allow ample time for dual LLM processing

// Initialize LM Studio OpenAI compatible provider
const lmstudio = createOpenAI({
  baseURL: 'http://localhost:1234/v1',
  apiKey: 'lm-studio',
});

// Initialize Google Gemini provider
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

// Helper function to optimize and clean illustration prompts for maximum compatibility with Pollinations.ai
function sanitizeIllustrationPrompt(prompt: string): string {
  if (!prompt) return 'cute child exploring magical stars';
  
  // 1. Remove Korean characters completely
  let clean = prompt.replace(/[ㄱ-ㅎㅏ-ㅣ가-힣]/g, '').trim();
  
  // 2. Remove problematic special symbols, quotes, and excessive punctuations
  clean = clean.replace(/["'\\“”]/g, '');
  clean = clean.replace(/\s+/g, ' ');
  
  // 3. Shorten extremely long descriptions to avoid URL/query size limits in free image generation APIs
  const words = clean.split(' ');
  if (words.length > 25) {
    clean = words.slice(0, 22).join(' ');
  }
  
  // 4. Ensure it has safe keywords if result is too small or blank
  if (clean.length < 5) {
    return 'magical child in beautiful glowing fantasy space adventure';
  }
  
  return clean.trim();
}

export async function POST(req: Request) {
  try {
    const { name, interest, lesson } = await req.json();

    if (!name || !interest || !lesson) {
      return new Response(
        JSON.stringify({ error: 'Name, interest, and lesson are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[1/2] Generating original story from LM Studio... (Child: ${name})`);

    // Step 1: Generate the raw bedtime story text in Korean using local LM Studio
    const storyPrompt = `당신은 전 세계 아이들을 위해 아주 아름답고 감동적인 이야기를 짓는 최고의 아동 문학 작가입니다.
제공되는 자녀 정보(이름, 관심사, 교훈)를 바탕으로, 아이가 자연스럽게 몰입하고 감동을 받으며 편안하게 잠들 수 있는 '잠자리 동화'를 창작해 주세요.

[자녀 및 동화 설정]
- 주인공 이름: ${name} (동화 속 주인공은 반드시 "${name}"이어야 합니다)
- 아이의 관심사: ${interest} (이 관심사가 이야기의 핵심 소재나 배경으로 등장해야 합니다)
- 가르치고 싶은 교훈: ${lesson} (이 교훈이 주인공의 선택과 모험을 통해 자연스럽게 가슴으로 와닿도록 구성해 주세요)

[작성 지침]
1. 톤앤매너: 매우 따뜻하고 다정하며 차분한 한국어 구어체 존댓말(~했어요, ~했답니다, ~했지요)로 작성해 주세요.
2. 이야기 흐름:
   - 도입부: 주인공 ${name}의 일상과 관심사(${interest})를 소개하며 흥미를 끕니다.
   - 전개: 관심사(${interest})와 관련된 신비롭고 아기자기한 상상 속 세계를 탐험합니다.
   - 절정: 갈등이나 선택의 순간에 서게 되고, 이때 교훈(${lesson})의 가치를 깨달으며 스스로 훌륭한 선택을 해냅니다.
   - 결말: 모험을 마치고 포근한 침대로 돌아와, 깨달은 교훈을 마음속에 품고 행복하고 아늑하게 깊은 잠에 드는 차분하고 몽환적인 결말이어야 합니다.
3. 주의사항: 자극적이거나 무서운 괴물 등 잠을 방해하는 요소는 배제해 주세요. 오직 따뜻함, 평화로움, 마법 같은 분위기만 가득 채워주세요. 이야기 본문은 4~5개의 큰 단락으로 넉넉하게 작성해 주세요.`;

    const rawStoryResponse = await generateText({
      model: lmstudio('local-model'),
      prompt: storyPrompt,
      temperature: 0.75,
    });

    const rawStoryText = rawStoryResponse.text;
    console.log('[1/2] Raw story generation complete! Length:', rawStoryText.length);

    // Step 2: Page division and Illustration prompt generation using Gemini 3.5 Flash
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;
    
    if (hasGeminiKey) {
      console.log('[2/2] Segmenting story and creating illustration prompts using Google Gemini 3.5 Flash...');
      try {
        const result = await generateObject({
          model: google('gemini-2.5-flash'), // Vercel AI SDK map for latest Gemini Flash models
          schema: z.object({
            title: z.string().describe('아름답고 시적인 동화의 한글 제목'),
            pages: z.array(z.object({
              pageNumber: z.number().describe('1부터 시작하는 페이지 번호'),
              text: z.string().describe('해당 페이지에 배치될 한국어 동화 본문 텍스트'),
              illustrationPrompt: z.string().describe('이 페이지의 묘사에 어울리는 극상의 간단명료한 영어 이미지 생성 프롬프트. 한글 금지, 오직 영어만.')
            })).describe('기승전결에 맞추어 분할된 3~5개의 동화 페이지들')
          }),
          prompt: `당신은 세계 최고의 아동 그림 동화책 기획자입니다.
아래 제공된 [한국어 동화 원본]을 분석하여, 기승전결 흐름에 맞추어 3~5개의 가독성 좋은 '페이지'로 본문을 자연스럽게 쪼개어 배분해 주세요.
그리고 각 페이지의 장면 묘사에 어울리는 극상의 고품질 영문 이미지 생성 프롬프트(illustrationPrompt)를 지어주세요.

[한국어 동화 원본]
${rawStoryText}

[삽화 프롬프트 작성 지침]
1. 영문 프롬프트에는 장면의 인물, 배경, 행동 위주로 구체적이되 핵심 명사형 위주로 간단하고 콤팩트하게 작성하세요 (20단어 미만 권장).
2. 절대로 한글 문자(Korean characters)를 섞지 말고, 100% 영어(Pure English)로만 프롬프트를 작성해 주세요.
3. 그림에 글자, 알파벳, 자막, 텍스트(text, letters, words, writing)는 절대 보이지 않아야 함을 강조하세요.
4. 그림체나 예술 화풍 스타일은 나중에 일관되게 덧붙일 것이므로, 프롬프트 내부에는 "장면의 구체적인 비주얼 묘사"에만 집중해 영문으로 작성해 주세요.`,
        });

        // Clean & sanitize all prompts
        const sanitizedPages = result.object.pages.map(page => ({
          ...page,
          illustrationPrompt: sanitizeIllustrationPrompt(page.illustrationPrompt)
        }));

        console.log('[2/2] Hybrid generation complete!');
        return new Response(JSON.stringify({
          title: result.object.title,
          pages: sanitizedPages
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (geminiError: any) {
        console.error('Failed to segment story using Gemini 3.5 Flash. Falling back to local segmenter...', geminiError);
      }
    }

    // FALLBACK: If Gemini API key is missing or failed
    console.log('[2/2] [FALLBACK] Segmenting story locally...');
    
    const lines = rawStoryText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let title = `${name}의 꿈나라 여행`;
    let startIndex = 0;
    if (lines.length > 0) {
      const firstLine = lines[0];
      const titleMatch = firstLine.match(/\[(.*?)\]/);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1];
        startIndex = 1;
      } else if (firstLine.startsWith('제목:') || firstLine.startsWith('##')) {
        title = firstLine.replace(/^(제목:|##)\s*/, '').trim();
        startIndex = 1;
      } else if (firstLine.length < 30 && lines.length > 1) {
        title = firstLine;
        startIndex = 1;
      }
    }

    const remainingText = lines.slice(startIndex).join('\n\n');
    const paragraphs = remainingText.split('\n\n').filter(p => p.trim().length > 10);
    
    const pagesCount = Math.min(5, Math.max(3, paragraphs.length));
    const pages = [];

    // Simple robust keywords for child
    const safeTopicKeyword = interest.toLowerCase().includes('space') || interest.toLowerCase().includes('우주') ? 'space spaceship starlight' : 'magical fairy forest animal';
    
    for (let i = 0; i < pagesCount; i++) {
      const pageText = paragraphs[i] || '오늘 밤도 깊은 행복 속에서 별빛 이불을 덮고 예쁜 꿈을 꿉니다.';
      const promptDescription = `cute lovely child exploring dreamy magic ${safeTopicKeyword} with glowing stars and moon`;
      
      pages.push({
        pageNumber: i + 1,
        text: pageText,
        illustrationPrompt: promptDescription
      });
    }

    const fallbackResponse = {
      title,
      pages
    };

    return new Response(JSON.stringify(fallbackResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error generating story:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate story. Please verify LM Studio is running.',
        details: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
