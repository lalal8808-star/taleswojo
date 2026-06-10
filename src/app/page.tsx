'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  ChevronRight,
  Printer
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
  storySeed?: number;
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
    "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&auto=format&fit=crop&q=80", // Magical pastel bedtime forest illustration
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
    "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&auto=format&fit=crop&q=80", // Adorable dreamy night star child illustration
    "https://images.unsplash.com/photo-1559251606-c623743a6d76?w=800&auto=format&fit=crop&q=80", // Cute cozy teddy bear sleeping illustration
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
  const [ttsVoice, setTtsVoice] = useState('ko-KR-SunHiNeural'); // ko-KR-SunHiNeural (Mother), ko-KR-InJoonNeural (Father), ko-KR-JiMinNeural (Child)
  
  const [activeStory, setActiveStory] = useState<{ title: string; pages: StoryPage[]; storySeed?: number } | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const [loadingStage, setLoadingStage] = useState(1);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [imageAttempts, setImageAttempts] = useState<Record<string, number>>({});
  const [currentPreloadIndex, setCurrentPreloadIndex] = useState<number | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const isSpeakingRef = useRef(false);
  const currentPageIndexRef = useRef(0);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const imageTimeoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prefetchActiveRefs = useRef<Record<string, boolean>>({});

  // Theme Fallback selection based on interests keywords (uses index to select)
  const getThemeFallbackUrl = useCallback((index: number) => {
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
    return fallbacks[index % fallbacks.length];
  }, [interest]);

  // Compute absolute URL (uses 0-based page index to align keys correctly with watchdog!)
  // STYLE CONSISTENCY: Flux Schnell (Turbo) / Flux Dev model + stable unique seed.
  const getIllustrationUrl = useCallback((prompt: string, index: number, attempt = 0) => {
    const key = `${activeStory?.title || 'story'}-${index}`;
    
    if (imageErrors[key]) {
      return getThemeFallbackUrl(index);
    }
    
    if (!prompt) return getThemeFallbackUrl(index);
    
    // Fetch via local Google Imagen 3 API proxy with Unsplash redirect failover
    return `/api/illustration?prompt=${encodeURIComponent(prompt)}&index=${index}&interest=${encodeURIComponent(interest)}`;
  }, [activeStory, imageErrors, interest, getThemeFallbackUrl]);

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
          if (nextSec < 10) {
            setLoadingStage(1);
          } else if (nextSec >= 10 && nextSec < 18) {
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

  // Watchdog timer triggers fallback attempt OR forces Unsplash fallback on persistent load failures
  useEffect(() => {
    if (activeStory && activeStory.pages[currentPageIndex]) {
      const pageKey = `${activeStory.title}-${currentPageIndex}`;
      const isLoaded = loadedImages[pageKey] || false;
      const hasError = imageErrors[pageKey] || false;
      
      if (imageTimeoutTimerRef.current) {
        clearTimeout(imageTimeoutTimerRef.current);
      }
      
      if (!isLoaded && !hasError) {
        const attempt = imageAttempts[pageKey] || 0;
        // Resilient timeout for heavy model generation (model=sana/flux takes 15-40s on first load)
        // Wait 60 seconds for attempt 0, and 40 seconds for attempt 1
        const timeoutDuration = attempt === 0 ? 60000 : 40000;
        
        imageTimeoutTimerRef.current = setTimeout(() => {
          if (!loadedImages[pageKey] && !imageErrors[pageKey]) {
            if (attempt < 1) {
              console.warn(`[Watchdog Timeout] Page ${currentPageIndex + 1} took too long on attempt 0. Retrying with turbo...`);
              setImageAttempts(prev => ({ ...prev, [pageKey]: 1 }));
            } else {
              console.warn(`[Watchdog Timeout] Page ${currentPageIndex + 1} failed on all attempts. Swapping to fallback.`);
              setImageErrors(prev => ({ ...prev, [pageKey]: true }));
              setLoadedImages(prev => ({ ...prev, [pageKey]: true }));
            }
          }
        }, timeoutDuration);
      }
    }

    return () => {
      if (imageTimeoutTimerRef.current) {
        clearTimeout(imageTimeoutTimerRef.current);
      }
    };
  }, [currentPageIndex, activeStory, loadedImages, imageErrors, imageAttempts]);

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

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Controlled Sequential Image Preloader: Loads images one-by-one to avoid concurrent rate-limits and cache hits!
  useEffect(() => {
    if (activeStory && currentPreloadIndex !== null && currentPreloadIndex < activeStory.pages.length) {
      const idx = currentPreloadIndex;
      const page = activeStory.pages[idx];
      const pageKey = `${activeStory.title}-${idx}`;
      
      // If already marked as loaded, skip to the next page immediately!
      if (loadedImages[pageKey]) {
        setCurrentPreloadIndex(idx + 1);
        return;
      }
      
      // If already marked as failed (errored), skip to the next page immediately!
      if (imageErrors[pageKey]) {
        setCurrentPreloadIndex(idx + 1);
        return;
      }
      
      console.log(`[Sequential Preload] Loading page ${idx + 1}/${activeStory.pages.length}...`);
      const attempt = imageAttempts[pageKey] || 0;
      const url = getIllustrationUrl(page.illustrationPrompt, idx, attempt);
      
      const img = new Image();
      img.src = url;
      img.onload = () => {
        console.log(`[Sequential Preload] Successfully loaded page ${idx + 1}`);
        setLoadedImages(prev => ({ ...prev, [pageKey]: true }));
        setCurrentPreloadIndex(idx + 1); // Trigger next page preloading!
      };
      img.onerror = () => {
        console.warn(`[Sequential Preload] Failed to load page ${idx + 1} on attempt ${attempt}.`);
        const nextAttempt = attempt + 1;
        if (nextAttempt <= 1) {
          // Retry attempt 1 immediately
          setImageAttempts(prev => ({ ...prev, [pageKey]: nextAttempt }));
        } else {
          // Both failed, mark as error and advance
          setImageErrors(prev => ({ ...prev, [pageKey]: true }));
          setLoadedImages(prev => ({ ...prev, [pageKey]: true }));
          setCurrentPreloadIndex(idx + 1); // Advance to next page!
        }
      };
    }
  }, [activeStory, currentPreloadIndex, loadedImages, imageErrors, imageAttempts, getIllustrationUrl]);



  const handleImageLoad = (key: string) => {
    setLoadedImages(prev => ({ ...prev, [key]: true }));
  };

  const handleImageError = (key: string) => {
    const currentAttempt = imageAttempts[key] || 0;
    if (currentAttempt < 1) {
      console.warn(`[Image Failover] Illustration load failed on attempt 0 for key ${key}. Retrying with Flux Schnell (turbo)...`);
      setImageAttempts(prev => ({ ...prev, [key]: 1 }));
    } else {
      console.error(`[Image Failover] Illustration load failed on all attempts for key ${key}. Swapping to themed Unsplash URL.`);
      setImageErrors(prev => ({ ...prev, [key]: true }));
      setLoadedImages(prev => ({ ...prev, [key]: true })); // Resolve loading spinner instantly!
    }
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
    setImageAttempts({});
    prefetchActiveRefs.current = {};
    setCurrentPreloadIndex(null);

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

      // Generate a unique storySeed
      const storySeed = Math.floor(Math.random() * 1000000);
      const storyWithSeed = { ...data, storySeed };
      setActiveStory(storyWithSeed);
      setCurrentPreloadIndex(0); // Start sequential preloading!

      const newStory: StoryHistoryItem = {
        id: Date.now().toString(),
        name: name.trim(),
        interest: interest.trim(),
        lesson: lesson.trim(),
        title: data.title,
        pages: data.pages,
        date: new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }),
        storySeed,
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
    if (!activeStory) return;
    if (isSpeaking && isPaused && audioRef.current) {
      audioRef.current.play().catch(console.error);
      setIsPaused(false);
      return;
    }
    speakCurrentPage();
  };

  const speakCurrentPage = () => {
    if (!activeStory) return;
    
    // Reset previous audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const page = activeStory.pages[currentPageIndexRef.current];
    let textToRead = '';
    
    if (currentPageIndexRef.current === 0) {
      textToRead = `오늘의 동화 제목, ${activeStory.title}. `;
    }
    
    textToRead += page.text;
    const cleanText = textToRead.replace(/[#*\[\]]/g, '').trim();

    // Stream from our Edge TTS proxy API
    const audioUrl = `/api/tts?text=${encodeURIComponent(cleanText)}&voice=${ttsVoice}`;
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    
    audio.playbackRate = speechRate;
    
    audio.onplay = () => {
      setIsSpeaking(true);
      setIsPaused(false);

      // Prefetch the NEXT page's TTS audio in the background for zero-latency transition
      const nextIndex = currentPageIndexRef.current + 1;
      if (nextIndex < activeStory.pages.length) {
        const nextPage = activeStory.pages[nextIndex];
        const nextText = nextPage.text.replace(/[#*\[\]]/g, '').trim();
        const nextAudioUrl = `/api/tts?text=${encodeURIComponent(nextText)}&voice=${ttsVoice}`;
        
        console.log(`[Prefetch] Pre-loading TTS audio for page ${nextIndex + 1}...`);
        const prefetchAudio = new Audio();
        prefetchAudio.src = nextAudioUrl;
        prefetchAudio.preload = 'auto';
      }
    };

    audio.onended = () => {
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

    audio.onerror = (e) => {
      console.error('[Audio Playback Error]:', e);
      setIsSpeaking(false);
      setIsPaused(false);
    };

    audio.play().catch((err) => {
      console.warn('Audio play failed (waiting for user interaction):', err);
      setIsSpeaking(false);
      setIsPaused(false);
    });
  };

  const handlePauseSpeaking = () => {
    if (!audioRef.current) return;
    if (isSpeaking) {
      if (isPaused) {
        audioRef.current.play().catch(console.error);
        setIsPaused(false);
      } else {
        audioRef.current.pause();
        setIsPaused(true);
      }
    }
  };

  const handleStopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
    setIsPaused(false);
  };

  // Print Photo Book: Each page prints as a 4×6 inch (102×152mm) photo card
  const handlePrintBooklet = () => {
    if (!activeStory) return;

    // 1. Build logical page contents
    type PhotoPage = { type: 'cover' | 'story' | 'back'; title?: string; text?: string; imageUrl?: string; pageLabel?: string };
    const photoPages: PhotoPage[] = [];

    // Cover page
    const coverKey = `${activeStory.title}-0`;
    photoPages.push({
      type: 'cover',
      title: activeStory.title,
      imageUrl: getIllustrationUrl(activeStory.pages[0].illustrationPrompt, 0, imageAttempts[coverKey] || 0),
    });

    // Story pages
    activeStory.pages.forEach((page, idx) => {
      const pageKey = `${activeStory.title}-${idx}`;
      photoPages.push({
        type: 'story',
        text: page.text,
        imageUrl: getIllustrationUrl(page.illustrationPrompt, idx, imageAttempts[pageKey] || 0),
        pageLabel: `${idx + 1}`,
      });
    });

    // Back cover
    photoPages.push({ type: 'back', title: '끝' });

    // 2. Render each page as a 4x6 photo card
    const renderPage = (pg: PhotoPage): string => {
      if (pg.type === 'cover') {
        return `<div class="photo-page cover-page">
          ${pg.imageUrl ? `<img src="${pg.imageUrl}" class="bg-img" />` : ''}
          <div class="cover-overlay">
            <h1 class="cover-title">${pg.title || ''}</h1>
            <p class="cover-author">주인공: ${name || '아이'}</p>
            <p class="cover-date">${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>`;
      }
      if (pg.type === 'back') {
        return `<div class="photo-page back-page">
          <div class="back-content">
            <div class="back-deco">🌙✨</div>
            <h2 class="back-title">— 끝 —</h2>
            <p class="back-sub">오늘 밤도 행복한 꿈 꾸세요 💤</p>
          </div>
        </div>`;
      }
      // Story page — image fills top, text at bottom
      return `<div class="photo-page story-page">
        ${pg.imageUrl ? `<img src="${pg.imageUrl}" class="story-img" />` : '<div class="story-img-placeholder"></div>'}
        <div class="story-text-area">
          <div class="story-text">${pg.text || ''}</div>
          <div class="page-num">${pg.pageLabel || ''}</div>
        </div>
      </div>`;
    };

    // 3. Build all pages HTML
    let pagesHtml = '';
    photoPages.forEach((pg) => {
      pagesHtml += renderPage(pg);
    });

    // 4. Full print document — 4x6 inch photo size
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${activeStory.title} - 4×6 사진 동화책 출력</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&family=Noto+Sans+KR:wght@400;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
@page{size:4in 6in;margin:0;}
body{font-family:'Gaegu','Noto Sans KR',sans-serif;background:#f5f0eb;}

/* Each photo page: exactly 4x6 inches */
.photo-page{
  width:4in;height:6in;
  position:relative;overflow:hidden;
  page-break-after:always;
  background:#fff;
}
.photo-page:last-child{page-break-after:auto;}

/* === COVER === */
.cover-page{display:flex;align-items:center;justify-content:center;}
.cover-page .bg-img{
  position:absolute;top:0;left:0;width:100%;height:100%;
  object-fit:cover;filter:brightness(0.55) saturate(1.2);
}
.cover-overlay{
  position:relative;z-index:1;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:6px;padding:20px;text-align:center;
}
.cover-title{
  font-size:18pt;font-weight:700;color:#fff;
  text-shadow:0 2px 12px rgba(0,0,0,0.6),0 0 30px rgba(167,139,250,0.4);
  line-height:1.35;max-width:3.4in;
}
.cover-author{font-size:10pt;color:#e8d5f5;text-shadow:0 1px 4px rgba(0,0,0,0.5);}
.cover-date{font-size:8pt;color:#d1c4e9;text-shadow:0 1px 4px rgba(0,0,0,0.5);}

/* === STORY === */
.story-page{display:flex;flex-direction:column;position:relative;}
.story-img{
  width:100%;height:3.8in;
  object-fit:cover;display:block;
  border-bottom:2px solid #f3e5f5;
}
.story-img-placeholder{
  width:100%;height:3.8in;
  background:linear-gradient(135deg,#ede7f6,#fce4ec);
}
.story-text-area{
  position:absolute;
  bottom:0;
  left:0;
  right:0;
  height:2.2in;
  padding:8px 12px 6px;
  display:flex;
  flex-direction:column;
  justify-content:space-between;
  background:linear-gradient(180deg,#fffdf9,#fef9ef);
  box-sizing:border-box;
  overflow:hidden;
}
.story-text{
  font-size:9.5pt;line-height:1.4;color:#333;
  word-break:keep-all;
}
.page-num{font-size:7pt;color:#bbb;text-align:center;padding-top:2px;}

/* === BACK === */
.back-page{
  display:flex;align-items:center;justify-content:center;
  background:linear-gradient(160deg,#e8eaf6,#fce4ec);
}
.back-content{text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px;}
.back-deco{font-size:28pt;}
.back-title{font-size:18pt;font-weight:700;color:#4a148c;}
.back-sub{font-size:10pt;color:#7b1fa2;}

/* Loading bar (screen only) */
.bar{position:fixed;top:0;left:0;right:0;padding:14px;background:#4a148c;color:#fff;text-align:center;font-family:'Noto Sans KR',sans-serif;font-size:14px;z-index:999;}
@media print{.bar{display:none;}}

/* Screen preview: center pages with slight shadow */
@media screen{
  body{display:flex;flex-direction:column;align-items:center;gap:16px;padding:60px 16px 32px;}
  .photo-page{box-shadow:0 4px 20px rgba(0,0,0,0.15);border-radius:4px;}
}
</style></head><body>
<div class="bar" id="bar">📖 4×6 사진 크기로 준비 중... 잠시만 기다려 주세요</div>
${pagesHtml}
<script>
const imgs=document.querySelectorAll('img');let loaded=0;const total=imgs.length;
function done(){document.getElementById('bar').textContent='✅ 준비 완료! 인쇄 창이 열립니다...';setTimeout(()=>window.print(),800);}
if(!total){done();}else{imgs.forEach(i=>{const ck=()=>{loaded++;document.getElementById('bar').textContent='📖 그림 불러오는 중... ('+loaded+'/'+total+')';if(loaded>=total)done();};if(i.complete)ck();else{i.onload=ck;i.onerror=ck;}});setTimeout(()=>{if(loaded<total){document.getElementById('bar').textContent='⚠️ 일부 그림을 건너뛰고 인쇄합니다...';setTimeout(()=>window.print(),500);}},30000);}
</script></body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const selectHistoryItem = (item: StoryHistoryItem) => {
    handleStopSpeaking();
    setName(item.name);
    setInterest(item.interest);
    setLesson(item.lesson);
    
    // Fallback seed from title hash if historical item does not have a storySeed
    const storySeed = item.storySeed || (item.title.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) * 137 + 1000);
    setActiveStory({
      title: item.title,
      pages: item.pages,
      storySeed
    });
    setCurrentPageIndex(0);
    setLoadedImages({});
    setImageErrors({});
    setImageAttempts({});
    prefetchActiveRefs.current = {};
    setCurrentPreloadIndex(0); // Start preloading sequential pages!
    
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
  
  const currentImageUrl = useMemo(() => {
    if (!activePage) return '';
    const attempt = imageAttempts[imageKey] || 0;
    return getIllustrationUrl(activePage.illustrationPrompt, currentPageIndex, attempt);
  }, [activePage, currentPageIndex, imageKey, imageAttempts, getIllustrationUrl]);

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
                      LM Studio가 포근한 10페이지 동화 창작 중... (15초 내외)
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
                      10페이지 분할 및 각 페이지별 삽화 구상 중...
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
                  width: `${Math.min(100, (loadingSeconds / 25) * 100)}%`,
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

                <div className="audio-speed-control" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>목소리:</span>
                    <select 
                      className="audio-speed-select"
                      value={ttsVoice}
                      onChange={(e) => {
                        const newVoice = e.target.value;
                        setTtsVoice(newVoice);
                        if (isSpeaking) {
                          handleStopSpeaking();
                          setTimeout(() => speakCurrentPage(), 100);
                        }
                      }}
                    >
                      <option value="ko-KR-SunHiNeural">👩 따뜻한 엄마 (선희)</option>
                      <option value="ko-KR-InJoonNeural">👨 차분한 아빠 (인준)</option>
                      <option value="ko-KR-JiMinNeural">👧 귀여운 아이 (지민)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>속도:</span>
                    <select 
                      className="audio-speed-select" 
                      value={speechRate} 
                      onChange={(e) => {
                        const newRate = parseFloat(e.target.value);
                        setSpeechRate(newRate);
                        if (audioRef.current) {
                          audioRef.current.playbackRate = newRate;
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
              </div>

              {/* Title & Page Header */}
              <div className="story-header" style={{ paddingBottom: '10px', marginBottom: '10px' }}>
                <div className="story-meta">
                  <span className="story-meta-pill">주인공: {name || '아이'}</span>
                  <span className="story-meta-pill">페이지 {currentPageIndex + 1} / {totalPages}</span>
                </div>
                <h2 className="story-title" style={{ fontSize: '2rem' }}>✨ {activeStory.title}</h2>
              </div>

              {/* 4×6 PHOTO CARD LAYOUT — matches print output */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                flex: 1,
                alignItems: 'center',
                padding: '10px 0'
              }}>
                <div style={{
                  width: '100%',
                  maxWidth: '400px',
                  aspectRatio: '4/6',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(167,139,250,0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative'
                }}>
                  {/* Top: Illustration — 63% of card */}
                  <div style={{
                    position: 'relative',
                    width: '100%',
                    height: '63%',
                    overflow: 'hidden',
                    background: 'linear-gradient(135deg, #1e1b4b, #311042)',
                    flexShrink: 0
                  }}>
                    {activePage.illustrationPrompt || imageErrors[imageKey] ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          key={imageKey}
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
                        
                        {/* Loading indicator */}
                        {!isImageLoaded && (
                          <div style={{ 
                            position: 'absolute', 
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px', 
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--color-secondary)',
                            padding: '0 20px',
                            textAlign: 'center'
                          }}>
                            <RefreshCw className="animate-spin text-secondary" size={24} />
                            <span className="animate-pulse" style={{ fontFamily: 'var(--font-title)', fontSize: '0.95rem', fontWeight: 'bold' }}>
                              밤별빛으로 도화지 채우는 중...
                            </span>
                            <span style={{ fontSize: '0.75rem', opacity: 0.8, maxWidth: '240px', lineHeight: '1.4' }}>
                              처음 그리는 마법 그림은 약 15~30초가 소요됩니다 ✨
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ 
                        width: '100%', height: '100%', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--color-text-secondary)', fontSize: '0.9rem' 
                      }}>일러스트를 기획하지 못했습니다.</div>
                    )}
                  </div>

                  {/* Bottom: Text area — 45% of card */}
                  <div style={{
                    flex: 1,
                    padding: '12px 16px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    background: 'linear-gradient(180deg, #fffdf9, #fef9ef)',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      fontSize: '1.18rem',
                      lineHeight: '1.5',
                      color: '#333',
                      fontFamily: 'var(--font-title)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'keep-all',
                      overflowY: 'auto',
                      flex: 1
                    }}>
                      {activePage.text}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#bbb',
                      textAlign: 'center',
                      paddingTop: '4px'
                    }}>
                      {currentPageIndex + 1}
                    </div>
                  </div>
                </div>
              </div>


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

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button 
                    type="button"
                    className="audio-btn"
                    onClick={handlePrintBooklet}
                    title="4×6 사진 크기로 동화책 출력"
                    style={{ width: '45px', height: '45px', borderRadius: '12px', background: 'rgba(167,139,250,0.15)', color: 'var(--color-primary)' }}
                  >
                    <Printer size={20} />
                  </button>
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
