import { createOpenAI } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';

export const maxDuration = 120; // Allow ample time for dual LLM processing

// Map local GEMINI_API_KEY to standard GOOGLE_GENERATIVE_AI_API_KEY for Vercel AI SDK V6
if (process.env.GEMINI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
}

// Initialize LM Studio OpenAI compatible provider
const lmstudio = createOpenAI({
  baseURL: 'http://localhost:1234/v1',
  apiKey: 'lm-studio',
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
  if (words.length > 20) {
    clean = words.slice(0, 16).join(' ');
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

    // Rich and immersive bedtime story prompt — 10-page full story arc
    const storyPrompt = `당신은 전 세계 아이들을 위해 아주 아름답고 감동적인 이야기를 짓는 최고의 아동 문학 작가입니다.
제공되는 자녀 정보(이름, 관심사, 교훈)를 바탕으로, 아이가 자연스럽게 몰입하고 감동을 받으며 편안하게 잠들 수 있는 '잠자리 동화'를 창작해 주세요.

[자녀 및 동화 설정]
- 주인공 이름: ${name} (동화 속 주인공은 반드시 "${name}"이어야 합니다)
- 아이의 관심사: ${interest} (이 관심사가 이야기의 핵심 소재나 배경으로 등장해야 합니다)
- 가르치고 싶은 교훈: ${lesson} (이 교훈이 주인공의 선택과 모험을 통해 자연스럽게 가슴으로 와닿도록 구성해 주세요)

[작성 지침 - 풍부하고 포근한 10페이지 완결 동화]
1. 분량 설정: 전체 본문은 정확히 10개의 아름다운 문단으로 작성해 주세요. 각 문단이 그림 동화책의 한 페이지가 됩니다.
2. 문장 스타일: 각 문단(페이지)은 4~6개의 풍성하고 감성적인 묘사 위주의 문장으로 작성해 주세요. 아이가 머릿속으로 신비로운 장면을 상상할 수 있도록 감성적인 형용사와 포근한 자연 묘사(예: '살랑살랑 부는 은빛 밤바람', '밤하늘을 사뿐사뿐 걷는 분홍색 아기 구름 침대')를 아주 듬뿍 곁들여 주세요.
3. 톤앤매너: 매우 따뜻하고 다정하며 차분한 한국어 구어체 존댓말 (~했어요, ~했답니다, ~했지요)로 작성해 주세요.
4. 10페이지 완결 이야기 구조 (반드시 아래 흐름을 따라 주세요):
   - 1페이지 (평화로운 일상): ${name}의 포근한 일상과 관심사(${interest})에 대한 호기심을 묘사합니다.
   - 2페이지 (모험의 시작): 신비로운 사건이 일어나 ${name}가 환상의 세계로 모험을 떠납니다.
   - 3페이지 (새로운 세계): 모험 세계의 놀랍고 아름다운 풍경과 분위기를 생생하게 묘사합니다.
   - 4페이지 (특별한 만남): 이야기의 핵심 조력자(신비한 친구)를 만나 함께 여정을 시작합니다.
   - 5페이지 (깊어지는 모험): 친구와 함께 더 깊은 모험 속으로 들어가며 놀라운 경험을 합니다.
   - 6페이지 (위기 발생): 뜻밖의 어려움이나 갈등이 발생하여 주인공이 난감해합니다.
   - 7페이지 (시련과 고민): ${name}가 좌절하지만 포기하지 않고 용기를 내어 해결 방법을 고민합니다.
   - 8페이지 (교훈의 깨달음): 주인공이 스스로 지혜를 발휘하여 교훈(${lesson})의 가치를 깨닫습니다.
   - 9페이지 (해결과 감동): 깨달은 교훈으로 문제를 따뜻하게 해결하고 친구들과 기쁨을 나눕니다.
   - 10페이지 (포근한 잠자리 결말): 집으로 무사히 돌아와 밤하늘의 별빛 이불을 덮고 행복하고 평화롭게 잠이 듭니다.
5. 완결성: 이야기는 반드시 시작·갈등·해결·결말의 완전한 서사 구조를 가져야 합니다. 열린 결말이나 미완성은 절대 안 됩니다.`;

    let rawStoryText = '';
    let usedModel = 'LM Studio';

    const isLocal = process.env.NODE_ENV !== 'production' && !process.env.VERCEL;
    
    // Step 1: Generate the raw bedtime story text in Korean
    if (isLocal) {
      console.log(`[1/2] Attempting to generate original story from LM Studio... (Child: ${name})`);
      try {
        const rawStoryResponse = await generateText({
          model: lmstudio('local-model'),
          prompt: storyPrompt,
          temperature: 0.7,
          maxOutputTokens: 4000, // High token cap for 10-page story
        });
        rawStoryText = rawStoryResponse.text;
        console.log('[1/2] LM Studio story generation complete! Length:', rawStoryText.length);
      } catch (lmstudioError: any) {
        console.warn('LM Studio is not running or failed. Falling back to Google Gemini...', lmstudioError.message);
      }
    }

    // Fallback to Google Gemini if we are in production or LM Studio is down
    if (!rawStoryText) {
      const hasGeminiKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!hasGeminiKey) {
        throw new Error('Google Gemini API Key is missing. Cannot generate story.');
      }
      
      console.log(`[1/2] Generating original story from Google Gemini (Production optimized)... (Child: ${name})`);
      
      let storyResponse;
      try {
        // Try gemini-2.0-flash first as the most reliable default production model
        storyResponse = await generateText({
          model: google('gemini-2.0-flash'),
          prompt: storyPrompt,
          temperature: 0.7,
          maxOutputTokens: 5000,
        });
        usedModel = 'Google Gemini 2.0 Flash';
      } catch (err) {
        console.warn('Gemini 2.0 Flash failed, trying Gemini 1.5 Flash...', err);
        try {
          storyResponse = await generateText({
            model: google('gemini-1.5-flash'),
            prompt: storyPrompt,
            temperature: 0.7,
            maxOutputTokens: 1500,
          });
          usedModel = 'Google Gemini 1.5 Flash';
        } catch (err2) {
          console.warn('Gemini 1.5 Flash failed, falling back to Gemini 2.5 Flash...', err2);
          try {
            storyResponse = await generateText({
              model: google('gemini-2.5-flash'),
              prompt: storyPrompt,
              temperature: 0.7,
              maxOutputTokens: 1500,
            });
            usedModel = 'Google Gemini 2.5 Flash';
          } catch (err3) {
            console.error('All Gemini model text generation attempts failed.', err3);
            throw err3;
          }
        }
      }
      
      rawStoryText = storyResponse.text;
      console.log(`[1/2] Google Gemini story generation complete using ${usedModel}! Length:`, rawStoryText.length);
    }

    // Step 2: Page division and Illustration prompt generation using Google Gemini
    const hasGeminiKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    
    if (hasGeminiKey) {
      console.log('[2/2] Segmenting story and creating illustration prompts using Google Gemini...');
      try {
        let result;
        const objectSchema = z.object({
          title: z.string().describe('아름답고 시적인 동화의 한글 제목'),
          pages: z.array(z.object({
            pageNumber: z.number().describe('1부터 시작하는 페이지 번호'),
            text: z.string().describe('해당 페이지에 배치될 한국어 동화 본문 텍스트'),
            illustrationPrompt: z.string().describe('이 페이지의 묘사에 어울리는 극상의 간단명료한 영어 이미지 생성 프롬프트. 한글 금지, 오직 영어만.')
          })).describe('완결된 서사 구조에 맞추어 분할된 10개의 동화 페이지들')
        });

        const objectPrompt = `당신은 세계 최고의 아동 그림 동화책 기획자입니다.
아래 제공된 [한국어 동화 원본]을 분석하여, 완결된 서사 흐름에 맞추어 정확히 10개의 가독성 좋은 '페이지'로 본문을 자연스럽게 쪼개어 배분해 주세요.
그리고 각 페이지의 장면 묘사에 어울리는 극상의 고품질 영문 이미지 생성 프롬프트(illustrationPrompt)를 지어주세요.

[10페이지 분할 구조]
1페이지: 평화로운 일상 / 2페이지: 모험의 시작 / 3페이지: 새로운 세계 / 4페이지: 특별한 만남
5페이지: 깊어지는 모험 / 6페이지: 위기 발생 / 7페이지: 시련과 고민
8페이지: 교훈의 깨달음 / 9페이지: 해결과 감동 / 10페이지: 포근한 잠자리 결말

[한국어 동화 원본]
${rawStoryText}

[삽화 프롬프트 작성 지침 — 동화책 그림체 필수]
1. [구도 다양화 및 소년 얼굴 클로즈업 금지 - 매우 중요]
   소년의 얼굴만 화면 가득 나오는 초상화나 클로즈업(portrait, close-up, face close-up) 구도는 절대 피하세요. 
   대신 소년이 배경 속에 아주 작고 예쁘게 배치되는 넓은 풍경 구도(wide shot, landscape scene, full body shot, scenic shot)를 사용하여, 주변의 신비로운 마법 배경 환경(은하수 다리, 별자리, 공룡 숲 등)이 화면의 대부분을 차지하도록 하세요. 소년은 전체 화면의 10% 이하 크기로 작게 조화되어야 합니다!
2. [Flux 및 SANA 엔진 최적화 프롬프트 문장 공식 준수 - 매우 중요]
   각 페이지의 영어 프롬프트는 단어의 나열이 아닌 자연스럽고 심플한 '한 줄의 영어 문장'으로 작성해 주세요. 불필요하고 중복되는 스타일 미사여구는 빼고, 핵심 행동과 캐릭터 묘사만 아래 공식으로 정확히 35단어 내외로 콤팩트하게 표현해 주세요:
   "A whimsical children's book illustration of [구체적인 공간 배경 및 소년의 행동/액션], featuring a cute cartoon child with short black hair, wearing blue star pajamas, watercolor style."
   - 예시 (완벽한 사례): "A whimsical children's book illustration of a child crossing a glowing Milky Way bridge under a meteor shower, featuring a cute cartoon child with short black hair, wearing blue star pajamas, watercolor style."
3. 각 프롬프트는 해당 페이지의 이야기 내용과 정확히 일치하는 독창적이고 구체적인 상황을 묘사하여, 10개 페이지의 그림들이 서로 완전히 다른 고유한 구도와 장면을 보여주게 하세요.
4. 절대로 한글 문자(Korean characters)를 섞지 말고, 100% 영어(Pure English)로만 작성해 주세요.
5. 그림에 글자, 알파벳, 자막, 텍스트(text, letters, words, writing)는 절대 보이지 않아야 합니다.`;

        try {
          result = await generateObject({
            model: google('gemini-2.0-flash'),
            schema: objectSchema,
            prompt: objectPrompt,
          });
        } catch (err) {
          console.warn('Gemini 2.0 Flash object generation failed, trying Gemini 1.5 Flash...', err);
          try {
            result = await generateObject({
              model: google('gemini-1.5-flash'),
              schema: objectSchema,
              prompt: objectPrompt,
            });
          } catch (err2) {
            console.warn('Gemini 1.5 Flash object generation failed, falling back to Gemini 2.5 Flash...', err2);
            result = await generateObject({
              model: google('gemini-2.5-flash'),
              schema: objectSchema,
              prompt: objectPrompt,
            });
          }
        }

        // Clean & sanitize all prompts
        const sanitizedPages = result.object.pages.map(page => ({
          ...page,
          illustrationPrompt: sanitizeIllustrationPrompt(page.illustrationPrompt)
        }));

        console.log('[2/2] Google Gemini generation and segmentation complete!');
        return new Response(JSON.stringify({
          title: result.object.title,
          pages: sanitizedPages
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (geminiError: any) {
        console.error('Failed to segment story using Gemini. Falling back to local segmenter...', geminiError);
      }
    }

    // FALLBACK: If Gemini API key is missing or completely failed
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
    
    // Target 10 pages; split large paragraphs if we have fewer than 10
    let expandedParagraphs = [...paragraphs];
    while (expandedParagraphs.length < 10 && expandedParagraphs.length > 0) {
      // Find the longest paragraph and split it in half by sentences
      let longestIdx = 0;
      expandedParagraphs.forEach((p, i) => { if (p.length > expandedParagraphs[longestIdx].length) longestIdx = i; });
      const longest = expandedParagraphs[longestIdx];
      const sentences = longest.split(/(?<=\.)\s+/);
      if (sentences.length >= 2) {
        const mid = Math.ceil(sentences.length / 2);
        expandedParagraphs.splice(longestIdx, 1, sentences.slice(0, mid).join(' '), sentences.slice(mid).join(' '));
      } else {
        break; // Can't split further
      }
    }
    
    const pagesCount = Math.min(10, Math.max(10, expandedParagraphs.length));
    const pages = [];

    // Simple Korean keywords to English matching for diverse fallback prompts
    const interestLower = interest.toLowerCase();
    let safeTopicKeyword = 'magical fairy forest animal';
    
    if (interestLower.includes('우주') || interestLower.includes('우주선') || interestLower.includes('별') || interestLower.includes('은하수') || interestLower.includes('space') || interestLower.includes('star')) {
      safeTopicKeyword = 'magical starry space, cute spaceship, glowing galaxy and glowing stars';
    } else if (interestLower.includes('바다') || interestLower.includes('물고기') || interestLower.includes('고래') || interestLower.includes('보물') || interestLower.includes('sea') || interestLower.includes('ocean')) {
      safeTopicKeyword = 'mysterious deep blue ocean, glowing colorful coral reefs, friendly sea creatures';
    } else if (interestLower.includes('공룡') || interestLower.includes('dinosaur')) {
      safeTopicKeyword = 'cozy baby dinosaur in a gentle sunlit jungle, warm ancient forest with cute flowers';
    } else if (interestLower.includes('장난감') || interestLower.includes('방') || interestLower.includes('인형') || interestLower.includes('toy')) {
      safeTopicKeyword = 'warm cozy bedroom full of cute friendly living toys and soft teddy bears';
    } else if (interestLower.includes('동물') || interestLower.includes('토끼') || interestLower.includes('숲') || interestLower.includes('forest') || interestLower.includes('animal')) {
      safeTopicKeyword = 'enchanted beautiful pastel forest, smiling cute woodland animals like bunnies and deer';
    } else if (interestLower.includes('구름') || interestLower.includes('하늘') || interestLower.includes('날개') || interestLower.includes('sky')) {
      safeTopicKeyword = 'flying on soft pink pastel clouds in the sky, beautiful starry pastel dreamland';
    } else {
      safeTopicKeyword = `magical whimsical landscape of ${interestLower.replace(/[^a-zA-Z가-힣\s]/g, '')}`;
    }
    
    const pageStages = [
      'peaceful daily life at cozy home',
      'starting a magical adventure journey',
      'discovering a beautiful new fantasy world',
      'meeting a special magical friend',
      'going deeper into an exciting adventure',
      'facing an unexpected challenge or problem',
      'struggling but finding courage to keep going',
      'having a warm realization and learning wisdom',
      'solving the problem with kindness and joy',
      'sleeping peacefully under starlight blankets at home'
    ];
    
    for (let i = 0; i < pagesCount; i++) {
      const pageText = expandedParagraphs[i] || '오늘 밤도 깊은 행복 속에서 별빛 이불을 덮고 예쁜 꿈을 꿉니다.';
      const promptDescription = `cute lovely child exploring ${safeTopicKeyword}, ${pageStages[i % pageStages.length]}`;
      
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
        error: 'Failed to generate story. Please verify your settings and API keys.',
        details: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
