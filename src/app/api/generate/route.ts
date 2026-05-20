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
    // We will check if GEMINI_API_KEY is available. If not, we will fallback to local parsing.
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
              text: z.string().describe('해당 페이지에 배치될 한국어 동화 본문 텍스트 (자연스럽게 이어지도록 페이지당 2~4개 문장 정도)'),
              illustrationPrompt: z.string().describe('이 페이지의 묘사에 어울리는 극상의 영어 이미지 생성 프롬프트. 주인공 비주얼(아이)과 배경이 묘사되어야 함. 단, 그림체 지침은 제외하고 장면 위주로만 영문 묘사할 것.')
            })).describe('기승전결에 맞추어 분할된 3~5개의 동화 페이지들')
          }),
          prompt: `당신은 세계 최고의 아동 그림 동화책 기획자입니다.
아래 제공된 [한국어 동화 원본]을 분석하여, 기승전결 흐름에 맞추어 3~5개의 가독성 좋은 '페이지'로 본문을 자연스럽게 쪼개어 배분해 주세요.
그리고 각 페이지의 장면 묘사에 어울리는 극상의 고품질 영문 이미지 생성 프롬프트(illustrationPrompt)를 지어주세요.

주인공 이름: ${name}
아이의 관심사: ${interest}

[한국어 동화 원본]
${rawStoryText}

[삽화 프롬프트 작성 지침]
1. 영문 프롬프트에는 장면의 인물(예: A little kid named ${name} with happy eyes), 배경(예: sailing in a sparkling galaxy ship made of glowing starlight), 행동 위주로 구체적으로 묘사하세요.
2. 그림에 글자, 알파벳, 자막, 텍스트(text, letters, words, writing)는 절대 보이지 않아야 함을 강조하세요.
3. 그림체나 예술 화풍 스타일(예: children's watercolor style 등)은 나중에 일관되게 덧붙일 것이므로, 프롬프트 내부에는 "장면의 구체적인 비주얼 묘사"에만 집중해 영문으로 작성해 주세요.`,
        });

        console.log('[2/2] Hybrid generation with Gemini complete! Sending structured JSON.');
        return new Response(JSON.stringify(result.object), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (geminiError: any) {
        console.error('Failed to segment story using Gemini 3.5 Flash. Falling back to local segmenter...', geminiError);
        // If Gemini fails, we go to fallback
      }
    }

    // FALLBACK: If Gemini API key is missing or failed, use local parser & generation
    console.log('[2/2] [FALLBACK] Segmenting story locally using rule-based paragraph divider...');
    
    // Attempt basic parsing of the raw story
    const lines = rawStoryText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let title = `${name}의 꿈나라 여행`;
    let bodyParagraphs: string[] = [];

    // Parse title if it looks like [제목] or first line
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

    // Join remaining text and split by double line breaks or chunk paragraphs
    const remainingText = lines.slice(startIndex).join('\n\n');
    const paragraphs = remainingText.split('\n\n').filter(p => p.trim().length > 10);
    
    // Group paragraphs into 3-5 pages
    const pagesCount = Math.min(5, Math.max(3, paragraphs.length));
    const pages = [];

    for (let i = 0; i < pagesCount; i++) {
      const pageText = paragraphs[i] || '오늘 밤도 깊은 행복 속에서 별빛 이불을 덮고 예쁜 꿈을 꿉니다.';
      
      // Build a simple heuristic translation prompt for the illustration
      const promptDescription = `A lovely child named ${name} experiencing a dreamy scene related to ${interest} with beautiful stars and moon.`;
      
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

    console.log('[Fallback] Local segmenter finished. Sending fallback JSON.');
    return new Response(JSON.stringify(fallbackResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error generating story:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate story. Please verify LM Studio is running on http://localhost:1234.',
        details: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
