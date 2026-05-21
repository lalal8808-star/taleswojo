'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Moon, 
  Play, 
  Pause, 
  Square, 
  Volume2, 
  User, 
  Heart, 
  Compass, 
  History, 
  Trash2, 
  Calendar, 
  RefreshCw,
  BookOpen,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface StoryPage {
  pageNumber: number;
  text: string;
  illustrationPrompt: string;
}

interface StoryHistoryItem {
  id: string;
  name: string;
  interest: string;
  lesson: string;
  title: string;
  pages: StoryPage[];
  date: string;
}

const INTEREST_PRESETS = [
  "아기 공룡과의 시간 여행",
  "은하수로 떠나는 비밀 우주선",
  "말하는 동물들의 무지개 숲",
  "바다 깊은 곳 신비한 보물섬",
  "장난감들이 살아 움직이는 마법 방",
  "구름을 타고 나르는 아기 날개"
];

const LESSON_PRESETS = [
  "친구와 소중한 장난감 나누기",
  "골고루 음식을 먹고 튼튼해지기",
  "자기 전에 양치질 스스로 하기",
  "넘어져도 다시 일어나는 씩씩한 용기",
  "부모님의 고마운 사랑을 깨닫기",
  "자연과 생명을 아끼고 사랑하기"
];

// Curated high-fidelity illustration URLs to instantly render beautiful artwork
const THEME_FALLBACKS = {
  space: [
    "https://images.unsplash.com/photo-1502134249126-9f3755a50d78?w=800&auto=format&fit=crop&q=80", // Yellow crescent moon & starry sky illustration
    "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=800&auto=format&fit=crop&q=80", // Magical pink/purple dreamy glitter
    "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80"  // Dreamy aurora night sky child aesthetic
  ],
  forest: [
    "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80", // Magical pastel bedtime forest illustration
    "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&auto=format&fit=crop&q=80", // Super cute watercolor flowers
    "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=800&auto=format&fit=crop&q=80"  // Whimsical sunlight trees
  ],
  toy: [
    "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=800&auto=format&fit=crop&q=80", // Cozy warm teddy bear room
    "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=800&auto=format&fit=crop&q=80", // Pastel toy blocks
    "https://images.unsplash.com/photo-1584824486509-112e4181ff6b?w=800&auto=format&fit=crop&q=80"  // Sweet 3D pastel shapes pattern
  ],
  sea: [
    "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&auto=format&fit=crop&q=80", // Dreamy pink/violet sunset ocean
    "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&auto=format&fit=crop&q=80", // Clear emerald secret underwater fantasy
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80"  // Soft 3D pastel bubbles
  ],
  default: [
    "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80", // Highly adorable watercolor animals and flowers
    "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80", // Dreamy pastel child fantasy book cover art
    "https://images.unsplash.com/photo-1502134249126-9f3755a50d78?w=800&auto=format&fit=crop&q=80"  // Starry golden moon
  ]
};

export default function Home() {
  const [name, setName] = useState('');
  const [interest, setInterest] = useState('');
  const [lesson, setLesson] = useState('');
  
  const [stars, setStars] = useState<{ id: number; left: string; top: string; sizeClass: string; delay: string }[]>([]);
  const [history, setHistory] = useState<StoryHistoryItem[]>([]);
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speechRate, setSpeechRate] = useState(0.85);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  const [activeStory, setActiveStory] = useState<{ title: string; pages: StoryPage[] } | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const [loadingStage, setLoadingStage] = useState(1);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const isSpeakingRef = useRef(false);
  const currentPageIndexRef = useRef(0);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const imageTimeoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    currentPageIndexRef.current = currentPageIndex;
  }, [currentPageIndex]);

  // Loading Stage timer
  useEffect(() => {
    if (isLoading) {
      setLoadingSeconds(0);
      setLoadingStage(1);
      
      loadingTimerRef.current = setInterval(() => {
        setLoadingSeconds(prev => {
          const nextSec = prev + 1;
          if (nextSec < 6) {
            setLoadingStage(1);
          } else if (nextSec >= 6 && nextSec < 9) {
            setLoadingStage(2);
          } else {
            setLoadingStage(3);
          }
          return nextSec;
        });
      }, 1000);
    } else {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    }

    return () => {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
      }
    };
  }, [isLoading]);

  // BUG FIX: Watchdog timer correctly triggers failover AND clears the pending loader state immediately!
  useEffect(() => {
    if (activeStory && activeStory.pages[currentPageIndex]) {
      const pageKey = `${activeStory.title}-${currentPageIndex}`;
      
      if (imageTimeoutTimerRef.current) {
        clearTimeout(imageTimeoutTimerRef.current);
      }
      
      // If the image hasn't loaded in 2.5 seconds, force switch to premium fallback and disable loader
      imageTimeoutTimerRef.current = setTimeout(() => {
        if (!loadedImages[pageKey] && !imageErrors[pageKey]) {
          console.warn(`[Watchdog Timeout] Image taking too long for ${pageKey}. Swapping to Unsplash.`);
          
          // 1. Force the image error state so src points to backup Unsplash immediately
          setImageErrors(prev => ({ ...prev, [pageKey]: true }));
          
          // 2. IMMEDIATELY set the image as loaded so the loading spinner vanishes and shows the themed fallback
          setLoadedImages(prev => ({ ...prev, [pageKey]: true }));
        }
      }, 2500); 
    }

    return () => {
      if (imageTimeoutTimerRef.current) {
        clearTimeout(imageTimeoutTimerRef.current);
      }
    };
  }, [currentPageIndex, activeStory, loadedImages, imageErrors]);

  // Mount setup
  useEffect(() => {
    const starList = Array.from({ length: 80 }).map((_, idx) => {
      const left = `${Math.random() * 100}%`;
      const top = `${Math.random() * 100}%`;
      const sizeClass = `star-${(idx % 3) + 1}`;
      const delay = `${(Math.random() * 5).toFixed(2)}s`;
      return { id: idx, left, top, sizeClass, delay };
    });
    setStars(starList);

    const saved = localStorage.getItem('tales_history');
    if (saved) {
      try {
        const parsedHistory = JSON.parse(saved);
        const migratedHistory = parsedHistory.map((item: any) => {
          if (!item.pages) {
            const paragraphs = item.body ? item.body.split('\n\n').filter((p: string) => p.trim().length > 0) : [];
            const pages: StoryPage[] = paragraphs.map((text: string, idx: number) => ({
              pageNumber: idx + 1,
              text: text.trim(),
              illustrationPrompt: `A beautiful pastel child's illustration showing a scene of ${item.interest} with child ${item.name}`
            }));
            return {
              id: item.id,
              name: item.name,
              interest: item.interest,
              lesson: item.lesson,
              title: item.title,
              pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: item.body || '', illustrationPrompt: '' }],
              date: item.date
            };
          }
          return item;
        });
        setHistory(migratedHistory);
      } catch (e) {
        console.error(e);
      }
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const loadVoices = () => {
        const voiceList = window.speechSynthesis.getVoices();
        const koVoices = voiceList.filter(v => v.lang.includes('ko'));
        setVoices(koVoices);
        if (koVoices.length > 0 && !selectedVoice) {
          setSelectedVoice(koVoices[0]);
        }
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Theme Fallback selection based on interests keywords
  const getThemeFallbackUrl = (pageNum: number) => {
    const curInterest = interest.toLowerCase();
    let themeKey: 'space' | 'forest' | 'toy' | 'sea' | 'default' = 'default';

    if (curInterest.includes('우주') || curInterest.includes('space') || curInterest.includes('별') || curInterest.includes('은하수')) {
      themeKey = 'space';
    } else if (curInterest.includes('숲') || curInterest.includes('동물') || curInterest.includes('공룡') || curInterest.includes('forest') || curInterest.includes('animal')) {
      themeKey = 'forest';
    } else if (curInterest.includes('방') || curInterest.includes('장난감') || curInterest.includes('toy') || curInterest.includes('집')) {
      themeKey = 'toy';
    } else if (curInterest.includes('바다') || curInterest.includes('섬') || curInterest.includes('물') || curInterest.includes('sea') || curInterest.includes('beach')) {
      themeKey = 'sea';
    }

    const fallbacks = THEME_FALLBACKS[themeKey];
    return fallbacks[pageNum % fallbacks.length];
  };

  // Compute absolute URL
  const getIllustrationUrl = (prompt: string, pageNum: number) => {
    const uniqueKey = `${activeStory?.title || 'story'}-${pageNum}`;
    
    // If watchdog marked an error or timeout, load themed high-speed Unsplash fallback instantly
    if (imageErrors[uniqueKey]) {
      return getThemeFallbackUrl(pageNum);
    }
    
    if (!prompt) return getThemeFallbackUrl(pageNum);
    
    // High-quality illustration styling to enforce beautiful children book art with 3D Disney/Pixar claymation & cute watercolors
    const stylePrefix = "super cute and warm 3D claymation style, Pixar Disney animation character, whimsical bedtime children's book illustration, beautiful soft watercolor pastel colors, cozy dreamy bedtime story aesthetic, extremely adorable, no words, no text, no letters";
    const fullPrompt = `${stylePrefix}, ${prompt}`;
    
    const seed = 1000 + pageNum * 250 + (activeStory?.title.length || 0);
    // Removed model=turbo to let Pollinations AI use its standard premium model for much higher artistic quality and kid appeal
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=640&height=480&nologo=true&seed=${seed}`;
  };

  const handleImageLoad = (key: string) => {
    setLoadedImages(prev => ({ ...prev, [key]: true }));
  };

  const handleImageError = (key: string) => {
    console.warn(`[Image Failover] Illustration loading failed for key ${key}. Swapping to themed Unsplash URL.`);
    setImageErrors(prev => ({ ...prev, [key]: true }));
    setLoadedImages(prev => ({ ...prev, [key]: true })); // Resolve loading spinner instantly!
  };

  // Generate fairy tale
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert('아이의 이름을 입력해 주세요.');
    if (!interest.trim()) return alert('아이의 관심사를 고르거나 입력해 주세요.');
    if (!lesson.trim()) return alert('가르쳐주고 싶은 교훈을 선택하거나 입력해 주세요.');

    handleStopSpeaking();
    setIsLoading(true);
    setActiveStory(null);
    setCurrentPageIndex(0);
    setLoadedImages({});
    setImageErrors({});

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          interest: interest.trim(),
          lesson: lesson.trim(),
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || '동화를 짓는 중 서버 지연이 발생했습니다.');
      }

      const data = await response.json();
      if (!data.pages || data.pages.length === 0) {
        throw new Error('올바른 동화 데이터 규격을 수신하지 못했습니다.');
      }

      setActiveStory(data);

      const newStory: StoryHistoryItem = {
        id: Date.now().toString(),
        name: name.trim(),
        interest: interest.trim(),
        lesson: lesson.trim(),
        title: data.title,
        pages: data.pages,
        date: new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }),
      };

      const updatedHistory = [newStory, ...history];
      setHistory(updatedHistory);
      localStorage.setItem('tales_history', JSON.stringify(updatedHistory));

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Fairy tale generation aborted.');
      } else {
        console.error(err);
        alert(err.message || '문제가 발생했습니다. 다시 한 번 시도해 주세요.');
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  const handleNextPage = () => {
    if (!activeStory) return;
    if (currentPageIndex < activeStory.pages.length - 1) {
      handleStopSpeaking();
      setCurrentPageIndex(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      handleStopSpeaking();
      setCurrentPageIndex(prev => prev - 1);
    }
  };

  // TTS
  const handleStartSpeaking = () => {
    if (!activeStory || typeof window === 'undefined') return;
    if (isSpeaking && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      return;
    }
    speakCurrentPage();
  };

  const speakCurrentPage = () => {
    if (!activeStory || typeof window === 'undefined') return;
    window.speechSynthesis.cancel();

    const page = activeStory.pages[currentPageIndexRef.current];
    let textToRead = '';
    
    if (currentPageIndexRef.current === 0) {
      textToRead = `오늘의 동화 제목, ${activeStory.title}. `;
    }
    
    textToRead += page.text;
    const cleanText = textToRead.replace(/[#*\[\]]/g, '').trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ko-KR';
    utterance.rate = speechRate;

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    } else {
      const defaultKo = voices.find(v => v.lang.includes('ko'));
      if (defaultKo) utterance.voice = defaultKo;
    }

    utterance.onend = () => {
      const nextIndex = currentPageIndexRef.current + 1;
      if (nextIndex < activeStory.pages.length) {
        setTimeout(() => {
          if (isSpeakingRef.current) {
            setCurrentPageIndex(nextIndex);
            speakCurrentPage();
          }
        }, 1500);
      } else {
        setIsSpeaking(false);
        setIsPaused(false);
      }
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
    setIsPaused(false);
  };

  const handlePauseSpeaking = () => {
    if (typeof window === 'undefined') return;
    if (window.speechSynthesis.speaking) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsPaused(true);
      }
    }
  };

  const handleStopSpeaking = () => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  };

  const selectHistoryItem = (item: StoryHistoryItem) => {
    handleStopSpeaking();
    setName(item.name);
    setInterest(item.interest);
    setLesson(item.lesson);
    setActiveStory({
      title: item.title,
      pages: item.pages
    });
    setCurrentPageIndex(0);
    setLoadedImages({});
    setImageErrors({});
    
    const bookEl = document.getElementById('storybook');
    if (bookEl) {
      bookEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const deleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem('tales_history', JSON.stringify(updated));
  };

  const handleSelectPresetInterest = (preset: string) => setInterest(preset);
  const handleSelectPresetLesson = (preset: string) => setLesson(preset);

  const activePage = activeStory?.pages[currentPageIndex];
  const totalPages = activeStory?.pages.length || 0;
  const imageKey = activeStory ? `${activeStory.title}-${currentPageIndex}` : '';
  const isImageLoaded = loadedImages[imageKey] || false;
  const currentImageUrl = activePage ? getIllustrationUrl(activePage.illustrationPrompt, activePage.pageNumber) : '';

  return (
    <div className="relative min-h-screen pb-20">
      <div className="night-sky">
        {stars.map((star) => (
          <div
            key={star.id}
            className={`star ${star.sizeClass}`}
            style={{
              left: star.left,
              top: star.top,
              animationDelay: star.delay,
            }}
          />
        ))}
        <div className="moon" />
      </div>

      <div className="app-container">
        <header className="app-header">
          <h1 className="app-title">달콤한 꿈나라 🌙</h1>
          <p className="app-subtitle">매일 밤 우리 아이에게 들려주는 세상 하나뿐인 그림 동화책</p>
        </header>

        {/* Inputs Form */}
        <section className="form-card glass-panel">
          <h2 className="input-label" style={{ fontSize: '1.6rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
            <Sparkles className="text-secondary" size={24} /> 
            아름다운 이야기 설정
          </h2>

          <form onSubmit={handleGenerate} className="flex flex-col gap-6">
            <div className="input-group">
              <label htmlFor="child-name" className="input-label">
                <User size={18} className="text-primary" />
                아이의 이름
              </label>
              <p className="input-desc">동화 속 지혜롭고 특별한 주인공이 됩니다.</p>
              <input
                id="child-name"
                type="text"
                className="text-input"
                placeholder="예: 민우, 서연, 예은"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={10}
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="child-interest" className="input-label">
                <Compass size={18} className="text-accent" />
                사랑하는 관심사
              </label>
              <p className="input-desc">아이가 좋아하는 환상의 모험 소재를 고르거나 써주세요.</p>
              <input
                id="child-interest"
                type="text"
                className="text-input"
                placeholder="예: 아기 오리구조대, 마법 초콜릿 공장"
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
                required
              />
              <div className="preset-container">
                {INTEREST_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`preset-pill ${interest === preset ? 'active' : ''}`}
                    onClick={() => handleSelectPresetInterest(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="child-lesson" className="input-label">
                <Heart size={18} className="text-primary" />
                나누고 싶은 교훈
              </label>
              <p className="input-desc">아이가 동화 모험 속에서 자연스럽게 마음 깊이 깨닫게 됩니다.</p>
              <input
                id="child-lesson"
                type="text"
                className="text-input"
                placeholder="예: 나누어 먹기, 자기전에 스스로 정리하기"
                value={lesson}
                onChange={(e) => setLesson(e.target.value)}
                required
              />
              <div className="preset-container">
                {LESSON_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`preset-pill ${lesson === preset ? 'active' : ''}`}
                    onClick={() => handleSelectPresetLesson(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <button 
              type="submit" 
              className="story-btn" 
              disabled={isLoading || !name || !interest || !lesson}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="animate-spin" size={24} />
                  마법 요정들이 붓 칠하는 중...
                </>
              ) : (
                <>
                  <Sparkles size={24} />
                  마법 그림 동화책 펼치기
                  <span className="shimmer" />
                </>
              )}
            </button>

            {isLoading && (
              <button 
                type="button" 
                className="story-btn" 
                style={{ background: '#ef4444', marginTop: '-10px', fontSize: '1.2rem', padding: '10px 0' }}
                onClick={handleCancelGeneration}
              >
                동화 짓기 멈추기
              </button>
            )}
          </form>
        </section>

        {/* Story Book View */}
        <section id="storybook" className="book-panel glass-panel" style={{ padding: '30px' }}>
          {isLoading ? (
            <div className="story-placeholder" style={{ padding: '20px 0' }}>
              <div className="placeholder-illustration" style={{ animation: 'floatMoon 4s ease-in-out infinite', fontSize: '4.5rem', marginBottom: '15px' }}>🔮🎨</div>
              
              <h3 className="app-title" style={{ fontSize: '1.9rem', textAlign: 'center', marginBottom: '20px' }}>
                마법 동화책이 열리고 있습니다... ({loadingSeconds}초)
              </h3>
              
              <div style={{
                width: '100%',
                maxWidth: '450px',
                display: 'flex',
                flexDirection: 'column',
                gap: '15px',
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '20px',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                margin: '0 auto'
              }}>
                {/* Stage 1 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  opacity: loadingStage === 1 ? 1 : 0.4,
                  transition: 'opacity 0.3s ease'
                }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: loadingStage === 1 ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    color: '#fff'
                  }}>
                    {loadingStage > 1 ? '✓' : '1'}
                  </div>
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: '600', color: loadingStage === 1 ? 'var(--color-primary)' : '#fff' }}>
                      요정들이 이야기를 지어내는 중
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      LM Studio가 포근한 한글 문장 창작 중... (8초 내외)
                    </div>
                  </div>
                </div>

                {/* Stage 2 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  opacity: loadingStage === 2 ? 1 : 0.4,
                  transition: 'opacity 0.3s ease'
                }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: loadingStage === 2 ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    color: '#fff'
                  }}>
                    {loadingStage > 2 ? '✓' : '2'}
                  </div>
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: '600', color: loadingStage === 2 ? 'var(--color-accent)' : '#fff' }}>
                      Gemini 3.5 Flash의 스케치 기획
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      기승전결 3페이지 분할 및 이미지 구상 중...
                    </div>
                  </div>
                </div>

                {/* Stage 3 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  opacity: loadingStage === 3 ? 1 : 0.4,
                  transition: 'opacity 0.3s ease'
                }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: loadingStage === 3 ? 'var(--color-secondary)' : 'rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    color: '#fff'
                  }}>
                    3
                  </div>
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: '600', color: loadingStage === 3 ? 'var(--color-secondary)' : '#fff' }}>
                      그림에 밤별빛 색칠하기
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      마법 도화지에 수채화 물감을 입히는 단계
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{
                width: '100%',
                maxWidth: '450px',
                height: '6px',
                borderRadius: '3px',
                background: 'rgba(255,255,255,0.05)',
                margin: '10px auto 0',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  height: '100%',
                  width: `${Math.min(100, (loadingSeconds / 12) * 100)}%`,
                  background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent), var(--color-secondary))',
                  transition: 'width 1s ease'
                }} />
              </div>
            </div>
          ) : activeStory && activePage ? (
            <div className="flex flex-col h-full justify-between" style={{ gap: '20px' }}>
              
              {/* TTS Audio Player Bar */}
              <div className="audio-bar" style={{ margin: 0 }}>
                <div className="audio-controls">
                  <button 
                    className={`audio-btn ${isSpeaking && !isPaused ? 'active' : ''}`}
                    onClick={handleStartSpeaking}
                    title="책 읽어주기 (자동 책장 넘김)"
                  >
                    <Play size={18} />
                  </button>
                  {isSpeaking && (
                    <>
                      <button 
                        className="audio-btn"
                        onClick={handlePauseSpeaking}
                        title={isPaused ? "다시 재생" : "일시정지"}
                      >
                        <Pause size={18} />
                      </button>
                      <button 
                        className="audio-btn"
                        style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}
                        onClick={handleStopSpeaking}
                        title="듣기 중지"
                      >
                        <Square size={18} />
                      </button>
                    </>
                  )}
                </div>
                
                <div className="audio-status">
                  <Volume2 size={16} className="text-accent animate-pulse" />
                  <span>{isSpeaking ? (isPaused ? '자장가 일시정지' : '자동 책장 넘기며 낭독 중...') : '오디오 북 켜기'}</span>
                </div>

                <div className="audio-speed-control">
                  <span>속도:</span>
                  <select 
                    className="audio-speed-select" 
                    value={speechRate} 
                    onChange={(e) => {
                      const newRate = parseFloat(e.target.value);
                      setSpeechRate(newRate);
                      if (isSpeaking) {
                        handleStopSpeaking();
                        setTimeout(() => speakCurrentPage(), 100);
                      }
                    }}
                  >
                    <option value="0.7">매우 천천히</option>
                    <option value="0.8">차분히 (잠자리용)</option>
                    <option value="0.9">보통 속도</option>
                    <option value="1.0">조금 빠르게</option>
                  </select>
                </div>
              </div>

              {/* Title & Page Header */}
              <div className="story-header" style={{ paddingBottom: '10px', marginBottom: '10px' }}>
                <div className="story-meta">
                  <span className="story-meta-pill">주인공: {name || '아이'}</span>
                  <span className="story-meta-pill">페이지 {currentPageIndex + 1} / {totalPages}</span>
                </div>
                <h2 className="story-title" style={{ fontSize: '2rem' }}>✨ {activeStory.title}</h2>
              </div>

              {/* TWO PANEL BEDTIME STORY BOOK LAYOUT */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: '24px',
                flex: 1,
                alignItems: 'center'
              }} className="md:grid-cols-2">
                
                {/* 1. Illustration Panel (No words child aesthetic) */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '4/3',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg, #1e1b4b, #311042)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  {activePage.illustrationPrompt || imageErrors[imageKey] ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        key={currentImageUrl}
                        src={currentImageUrl} 
                        alt="Bedtime story illustration"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          opacity: isImageLoaded ? 1 : 0.02,
                          transition: 'opacity 0.6s ease-in-out'
                        }}
                        onLoad={() => handleImageLoad(imageKey)}
                        onError={() => handleImageError(imageKey)}
                      />
                      
                      {/* Magical soft glowing loader until loaded */}
                      {!isImageLoaded && (
                        <div style={{ 
                          position: 'absolute', 
                          color: 'var(--color-secondary)', 
                          fontSize: '0.9rem', 
                          display: 'flex', 
                          flexDirection: 'column',
                          gap: '12px', 
                          alignItems: 'center' 
                        }}>
                          <RefreshCw className="animate-spin text-secondary" size={24} />
                          <span className="animate-pulse" style={{ fontFamily: 'var(--font-title)' }}>밤별빛으로 도화지 채우는 중...</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>일러스트를 기획하지 못했습니다.</div>
                  )}
                </div>

                {/* 2. Text Panel */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  minHeight: '150px'
                }}>
                  <div style={{
                    fontSize: '1.25rem',
                    lineHeight: '1.9',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-title)',
                    whiteSpace: 'pre-wrap',
                    textShadow: '0 1px 4px rgba(0,0,0,0.3)',
                    letterSpacing: '0.5px'
                  }}>
                    {activePage.text}
                  </div>
                </div>

              </div>

              {/* Book Page Turner Navigation */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                paddingTop: '15px',
                marginTop: '10px'
              }}>
                <button 
                  type="button"
                  className="audio-btn"
                  onClick={handlePrevPage}
                  disabled={currentPageIndex === 0}
                  style={{ width: '45px', height: '45px', borderRadius: '12px' }}
                >
                  <ChevronLeft size={24} />
                </button>
                
                <span style={{ fontSize: '1.1rem', fontFamily: 'var(--font-title)', color: 'var(--color-secondary)' }}>
                  <b>{currentPageIndex + 1}</b> / {totalPages} 장
                </span>

                <button 
                  type="button"
                  className="audio-btn"
                  onClick={handleNextPage}
                  disabled={currentPageIndex === totalPages - 1}
                  style={{ width: '45px', height: '45px', borderRadius: '12px' }}
                >
                  <ChevronRight size={24} />
                </button>
              </div>

            </div>
          ) : (
            <div className="story-placeholder">
              <div className="placeholder-illustration">📚🎠</div>
              <h3 className="app-title" style={{ fontSize: '2.2rem' }}>아름다운 그림 동화책</h3>
              <p style={{ color: 'var(--color-text-secondary)', maxWidth: '350px', textAlign: 'center', lineHeight: '1.6' }}>
                이름과 관심사, 그리고 따뜻한 교훈을 정해 <b>'마법 그림 동화책 펼치기'</b>를 터치해 주세요.
                좌측에는 아이 감성의 신비로운 삽화가, 우측에는 차분한 낭독이 흘러나옵니다.
              </p>
            </div>
          )}
        </section>

        {/* History section */}
        <section className="history-section">
          <h2 className="history-title">
            <History className="text-secondary" size={24} />
            우리 아이 꿈나라 보관함
          </h2>

          {history.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <BookOpen size={48} style={{ margin: '0 auto 15px', opacity: 0.3 }} />
              <p>아직 보관된 동화책이 없어요. 첫 번째 동화를 그려보세요!</p>
            </div>
          ) : (
            <div className="history-grid">
              {history.map((item) => (
                <div 
                  key={item.id} 
                  className="history-card glass-panel"
                  onClick={() => selectHistoryItem(item)}
                >
                  <div className="history-card-header">
                    <span className="history-card-date">
                      <Calendar size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                      {item.date}
                    </span>
                    <button 
                      className="history-card-delete"
                      onClick={(e) => deleteHistoryItem(e, item.id)}
                      title="보관함에서 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <h3 className="history-card-title">📖 {item.title}</h3>
                  <p className="history-card-desc" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {item.pages && item.pages[0] ? item.pages[0].text : '신비한 동화나라 이야기...'}
                  </p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: 'auto' }}>
                    <span className="story-meta-pill" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>주인공: {item.name}</span>
                    <span className="story-meta-pill" style={{ fontSize: '0.75rem', padding: '2px 8px', borderColor: 'rgba(167,139,250,0.2)', color: 'var(--color-primary)' }}>
                      총 {item.pages ? item.pages.length : 0} 장
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
