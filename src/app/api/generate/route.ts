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
- 아이의 관심사: ${interest} (이 관심사가 이야기 전체를 관통하는 핵심 소재이자 모든 배경으로 등장해야 합니다)
- 가르치고 싶은 교훈: ${lesson} (이 교훈이 주인공의 선택과 시련 극복을 통해 가슴 벅차게 느껴지도록 핵심 메시지로 삼아주세요)

⚠️ [매우 중요 - 이름 언어유희 금지 지침]
주인공 이름인 "${name}"이 특정 한국어 단어 뜻(예: '우주' ➔ 우주 공간, '바다' ➔ 바다 ocean, '하늘' ➔ 하늘 sky 등)을 가지고 있더라도, **절대 그 이름의 사전적 의미로 이야기를 전개하거나 배경을 잡지 마세요!**
예를 들어, 이름이 "${name}"이더라도 관심사가 "아기 공룡과의 시간 여행"이라면, 우주나 바다가 아닌 **반드시 오직 "아기 공룡과의 시간 여행"이 이야기의 실제 물리적 공간 배경과 핵심 주제가 되어야 합니다.** 주인공 이름은 단순히 고유 명사(인물)로만 취급해 주세요.

[작성 지침 - 풍부하고 포근한 10페이지 완결 동화]
1. 분량 설정: 전체 본문은 정확히 10개의 아름다운 문단으로 작성해 주세요. 각 문단이 그림 동화책의 한 페이지가 됩니다.
2. 문장 스타일: 각 문단(페이지)은 4~6개의 풍성하고 감성적인 묘사 위주의 문장으로 작성해 주세요. 아이가 머릿속으로 신비로운 장면을 상상할 수 있도록 감성적인 형용사와 포근한 자연 묘사(예: '살랑살랑 부는 은빛 밤바람', '밤하늘을 사뿐사뿐 걷는 분홍색 아기 구름 침대')를 아주 듬뿍 곁들여 주세요.
3. 톤앤매너: 매우 따뜻하고 다정하며 차분한 한국어 구어체 존댓말 (~했어요, ~했답니다, ~했지요)로 작성해 주세요.
4. 10페이지 완결 이야기 구조 (관심사와 교훈의 충실한 연계 필수!):
   - 1페이지 (평화로운 일상): 주인공 ${name}의 포근한 일상과, 평소 가장 호기심을 갖던 관심사(${interest})를 간절히 꿈꾸는 장면으로 시작합니다.
   - 2페이지 (모험의 시작): 마법 같은 신비로운 일이나 도구를 발견하여, ${name}가 드디어 꿈꾸던 관심사(${interest})의 신비한 모험 세계로 출발합니다.
   - 3페이지 (새로운 세계): 관심사(${interest}) 세계에 처음 도착하여 마주한 생생하고 아름다우며 웅장한 대자연 풍경과 시각적 신비로움을 집중적으로 묘사합니다.
   - 4페이지 (특별한 만남): 그 관심사(${interest})의 모험 세계에서 만난 핵심 친구(예: 귀여운 아기 공룡 등 관심사에 완벽히 어울리는 대상)와 조우하여 세상에 둘도 없는 친구가 됩니다.
   - 5페이지 (깊어지는 모험): 신비한 친구의 안내를 받으며 ${name}는 관심사(${interest})의 마법 세계 속에서 가장 신나고 즐거운 비밀 놀이를 즐깁니다.
   - 6페이지 (위기 발생): 한참 신나게 놀던 중, 문득 멀고 낯선 시공간에 와있음을 느끼며 부모님의 따뜻한 품을 벗어난 것에서 오는 뜻밖의 두려움이나 갈등, 위기 상황이 발생합니다.
   - 7페이지 (시련과 고민): ${name}가 길을 잃거나 어려움에 처하며, 언제나 자신을 묵묵히 보살펴주던 부모님의 한없는 사랑과 헌신을 그리워하고 소중함을 뼈저리게 느끼며 눈물짓고 고민합니다.
   - 8페이지 (교훈의 깨달음): 신비한 친구의 위로와 모험 속 단서를 통해, ${name}는 부모님이 매 순간 베풀어주신 고마운 사랑과 가르쳐주신 교훈(${lesson})의 깊은 은혜를 가슴 속 깊이 온전히 깨닫습니다.
   - 9페이지 (해결과 감동): 부모님의 사랑과 깨달은 교훈(${lesson})의 지혜를 힘입어 당면한 어려움을 감동적으로 이겨내고, 고마운 모험 친구와 따뜻한 포옹을 하며 작별 인사를 나눕니다.
   - 10페이지 (포근한 잠자리 결말): 마침내 부모님의 품(따뜻하고 안전한 우리 집 침대)으로 무사히 돌아와, 자신을 포근하게 안아주는 부모님의 따뜻한 숨결과 크신 사랑을 온몸으로 느끼며 밤하늘의 별빛 이불을 덮고 세상에서 가장 안락한 잠에 빠져듭니다.
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
      
      console.log(`[1/2] Generating original story from Google Gemini 3.5 Flash... (Child: ${name})`);
      
      const storyResponse = await generateText({
        model: google('gemini-3.5-flash'),
        prompt: storyPrompt,
        temperature: 0.7,
        maxOutputTokens: 5000,
      });
      usedModel = 'Google Gemini 3.5 Flash';
      
      rawStoryText = storyResponse.text;
      console.log(`[1/2] Google Gemini story generation complete! Length:`, rawStoryText.length);
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

[삽화 프롬프트 작성 지침 — 동화책 그림체 및 캐릭터 일관성 필수]
1. [주인공 캐릭터의 시각적 일관성 유지 - 최우선 순위]
   동화책의 전체적인 몰입도를 위해 모든 페이지의 삽화에 등장하는 주인공 아이는 기본적으로 아래의 외모적 특징을 지닌 동일 인물이어야 합니다.
   - 기본 외모 및 의상: "a cute 5-year-old Korean boy with short black hair, wearing warm yellow star-patterned pajamas" (단발머리에 노란 별 잠옷을 입은 5세 한국 남자아이)
   - [의상 일치 및 변경 예외 규칙]: 동화 본문 내용상 주인공이 옷을 다른 것으로 갈아입었다는 명시적인 설명(예: '반짝이는 우주복을 든든하게 챙겨 입었어요', '노란 비옷을 입고 장화를 신었어요')이 있는 페이지라면 해당 상황에 맞는 의상으로 변경하되, 그렇지 않고 단순히 모험을 떠나거나 행동하는 일반적인 페이지에서는 항상 기본 의상인 "warm yellow star-patterned pajamas"로 주인공의 의상을 완전히 일치시켜서 일관되게 그려야 합니다.
   - 매 페이지의 프롬프트에서 주인공을 그릴 때는 위의 기본 외모/의상 문구(또는 의상 변경 예외 묘사)를 주어로 사용하여 캐릭터의 외모적 일관성을 확실히 확보하세요.
2. [문장 공식 준수 - 매우 중요]
   각 페이지의 영어 프롬프트는 단어의 나열이 아닌 자연스럽고 심플한 '한 줄의 영어 문장'으로 작성해 주세요. 불필요하고 중복되는 스타일 미사여구는 빼고, 오직 마법 같은 풍경과 아래 공식으로만 작성해 주세요:
   "A whimsical watercolor children's book illustration of a cute 5-year-old Korean boy with short black hair wearing warm yellow star-patterned pajamas [해당 페이지의 공간 배경 및 구체적인 행동 묘사], beautiful fairytale scenery, warm pastel colors, nostalgic storybook style."
   - (의상이 명시적으로 바뀐 페이지의 경우 'wearing warm yellow star-patterned pajamas' 대신 변경된 의상 묘사를 넣으세요)
   - 예시 (완벽한 사례): "A whimsical watercolor children's book illustration of a cute 5-year-old Korean boy with short black hair wearing warm yellow star-patterned pajamas walking along a glowing Milky Way bridge under a purple starry space, beautiful fairytale scenery, warm pastel colors, nostalgic storybook style."
3. 각 프롬프트는 해당 페이지의 이야기 내용과 정확히 일치하는 독창적이고 구체적인 상황을 묘사하여, 10개 페이지의 그림들이 서로 완전히 다른 고유한 구도와 장면을 보여주게 하세요.
4. 절대로 한글 문자(Korean characters)를 섞지 말고, 100% 영어(Pure English)로만 작성해 주세요.
5. 그림에 글자, 알파벳, 자막, 텍스트(text, letters, words, writing)는 절대 보이지 않아야 합니다.`;

        result = await generateObject({
          model: google('gemini-3.5-flash'),
          schema: objectSchema,
          prompt: objectPrompt,
        });

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
      const promptDescription = `A whimsical watercolor children's book illustration of a cute 5-year-old Korean boy with short black hair wearing warm yellow star-patterned pajamas exploring ${safeTopicKeyword}, ${pageStages[i % pageStages.length]}, beautiful fairytale scenery, warm pastel colors, nostalgic storybook style`;
      
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
        error: '동화 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        details: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
