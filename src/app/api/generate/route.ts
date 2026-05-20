import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

// Next.js App Router API Route configuration
export const maxDuration = 60; // Set generous timeout for local LLMs which might be slow

// Initialize LM Studio OpenAI compatible provider
const lmstudio = createOpenAI({
  baseURL: 'http://localhost:1234/v1',
  apiKey: 'lm-studio', // Dummy API key required by the SDK but ignored by LM Studio
});

export async function POST(req: Request) {
  try {
    const { name, interest, lesson } = await req.json();

    if (!name || !interest || !lesson) {
      return new Response(
        JSON.stringify({ error: 'Name, interest, and lesson are required fields.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Design a premium fairy tale prompt for local LLMs
    const prompt = `당신은 전 세계 아이들을 위해 아주 아름답고 감동적인 이야기를 짓는 최고의 아동 문학 작가이자 다정한 부모님입니다.
아래에 제공되는 자녀의 정보(이름, 관심사, 부모님이 주고 싶은 교훈)를 바탕으로, 아이가 자연스럽게 몰입하고 감동을 받으며 편안하게 잠들 수 있는 '잠자리 동화'를 창작해 주세요.

[자녀 및 동화 설정]
- 주인공 이름: ${name} (동화 속 주인공은 반드시 "${name}"이어야 합니다)
- 아이의 관심사: ${interest} (이 관심사가 이야기의 핵심 소재나 배경, 혹은 주인공이 사랑하는 것으로 등장해야 합니다)
- 가르치고 싶은 교훈: ${lesson} (이 교훈이 너무 강압적이거나 훈계조가 아니라, 주인공의 모험과 감정 변화를 통해 자연스럽게 가슴으로 와닿도록 구성해 주세요)

[작성 지침 - 반드시 지켜주세요]
1. 톤앤매너: 매우 따뜻하고 다정하며 차분한 한국어 구어체 존댓말(~했어요, ~했답니다, ~했지요)로 작성해 주세요. 
2. 구조: 
   - 맨 첫 줄에 아름답고 시적인 [제목]을 지어주세요. (예: [달빛 우주선과 ${name}의 꿈의 여행])
   - 제목 아래에 1줄 띄우고 본문을 작성해 주세요.
   - 본문은 3~5개의 긴 문단으로 구성해 주세요. 각 문단은 기승전결이 확실해야 합니다.
3. 스토리 전개:
   - 도입부: 주인공 ${name}의 일상과 관심사(${interest})를 소개하며 흥미를 끕니다.
   - 전개: 관심사(${interest})와 관련된 신비롭고 아기자기한 상상 속 세계로 여행을 떠나거나 특별한 사건을 겪습니다.
   - 절정: 갈등이나 선택의 순간에 서게 되고, 이때 교훈(${lesson})의 가치를 깨달으며 스스로 훌륭한 선택을 해냅니다.
   - 결말: 모험을 마치고 포근한 침대로 돌아와, 깨달은 교훈을 마음속에 품고 행복하고 아늑하게 깊은 잠에 드는 차분하고 몽환적인 결말이어야 합니다. 마지막 문장은 반드시 아이가 편안하게 잠들도록 토닥여주는 문장으로 끝내주세요.
4. 금지사항: 자극적이거나 너무 신나는 모험, 무서운 괴물 등 잠을 방해하는 요소는 절대 배제해 주세요. 오직 따뜻함, 평화로움, 마법 같은 분위기만 가득 채워주세요.`;

    // streamText using Vercel AI SDK v6 with OpenAI provider targeting local LM Studio
    // Using 'local-model' which LM Studio maps automatically to currently loaded model
    const result = streamText({
      model: lmstudio('local-model'),
      prompt: prompt,
      temperature: 0.75, // Moderate temperature for creativity but coherence
    });

    // Return the stream compatible with useCompletion
    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error('Error generating story:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate story. Please make sure LM Studio is running on http://localhost:1234 and a model is loaded.',
        details: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
