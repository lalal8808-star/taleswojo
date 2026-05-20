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
  BookOpen
} from 'lucide-react';

interface StoryHistoryItem {
  id: string;
  name: string;
  interest: string;
  lesson: string;
  title: string;
  body: string;
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

export default function Home() {
  // Input fields state
  const [name, setName] = useState('');
  const [interest, setInterest] = useState('');
  const [lesson, setLesson] = useState('');
  
  // Custom generated stars for the night sky background
  const [stars, setStars] = useState<{ id: number; left: string; top: string; sizeClass: string; delay: string }[]>([]);
  
  // Saved history of fairy tales
  const [history, setHistory] = useState<StoryHistoryItem[]>([]);
  
  // Voice synthesis states (TTS)
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speechRate, setSpeechRate] = useState(0.85); // Cozy slow speed for bedtime stories
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  // Streaming and active story state
  const [activeStory, setActiveStory] = useState<{ title: string; body: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Abort controller for canceling stream
  const abortControllerRef = useRef<AbortController | null>(null);

  // Generate stars on mount
  useEffect(() => {
    const starList = Array.from({ length: 80 }).map((_, idx) => {
      const left = `${Math.random() * 100}%`;
      const top = `${Math.random() * 100}%`;
      const sizeClass = `star-${(idx % 3) + 1}`;
      const delay = `${(Math.random() * 5).toFixed(2)}s`;
      return { id: idx, left, top, sizeClass, delay };
    });
    setStars(starList);

    // Load history from localStorage
    const saved = localStorage.getItem('tales_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }

    // Load available speech synthesis voices
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const loadVoices = () => {
        const voiceList = window.speechSynthesis.getVoices();
        const koVoices = voiceList.filter(v => v.lang.includes('ko'));
        setVoices(koVoices);
        if (koVoices.length > 0 && !selectedVoice) {
          // Default to the first Korean voice
          setSelectedVoice(koVoices[0]);
        }
      };
      
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Parse [제목] / 제목: / 첫번째줄 패턴에서 제목과 본문을 분리
  const parseStory = (text: string) => {
    if (!text) return { title: '마법 같은 동화 속으로...', body: '' };
    
    const lines = text.split('\n');
    let title = '꿈나라 마법 여행';
    let body = text;

    // 1. Check for [제목] brackets
    const titleMatch = text.match(/\[(.*?)\]/);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1];
      body = text.replace(titleMatch[0], '').trim();
      return { title, body };
    }

    // 2. Check for lines starting with "제목:" or "##"
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      if (firstLine.startsWith('제목:') || firstLine.startsWith('##')) {
        title = firstLine.replace(/^(제목:|##)\s*/, '').trim();
        body = lines.slice(1).join('\n').trim();
        return { title, body };
      }
    }

    // 3. If first line is short and separated by empty line, treat as title
    if (lines.length > 1 && lines[0].trim().length > 0 && lines[0].trim().length < 35 && lines[1].trim() === '') {
      title = lines[0].trim();
      body = lines.slice(2).join('\n').trim();
      return { title, body };
    }

    // 4. Default: Keep full text in body
    return { title, body };
  };

  // Robust native fetch stream implementation for 100% protocol compatibility
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert('아이의 이름을 입력해 주세요.');
    if (!interest.trim()) return alert('아이의 관심사를 고르거나 입력해 주세요.');
    if (!lesson.trim()) return alert('가르쳐주고 싶은 교훈을 선택하거나 입력해 주세요.');

    // Stop speaking if playing
    handleStopSpeaking();
    
    setIsLoading(true);
    setActiveStory(null);

    // Setup abort controller
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
        throw new Error(errData.error || '이야기를 지어내는 도중 요정이 길을 잃었어요. LM Studio가 실행 중인지 꼭 확인해 주세요!');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      if (!reader) throw new Error('동화 스트림을 활성화하지 못했습니다.');

      let accumulatedText = '';

      // Stream read loop
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;

        // Parse and render in real time
        const parsed = parseStory(accumulatedText);
        setActiveStory(parsed);
      }

      // Finish streaming, parse finally
      const finalParsed = parseStory(accumulatedText);
      setActiveStory(finalParsed);

      // Save to history
      const newStory: StoryHistoryItem = {
        id: Date.now().toString(),
        name: name.trim(),
        interest: interest.trim(),
        lesson: lesson.trim(),
        title: finalParsed.title,
        body: finalParsed.body,
        date: new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }),
      };

      const updatedHistory = [newStory, ...history];
      setHistory(updatedHistory);
      localStorage.setItem('tales_history', JSON.stringify(updatedHistory));

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Fairy tale stream was gracefully aborted.');
      } else {
        console.error(err);
        alert(err.message || '이야기를 불러오는 중 문제가 발생했습니다.');
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

  // Select preset helper
  const handleSelectPresetInterest = (preset: string) => {
    setInterest(preset);
  };

  const handleSelectPresetLesson = (preset: string) => {
    setLesson(preset);
  };

  // Text to Speech logic
  const handleStartSpeaking = () => {
    if (!activeStory || typeof window === 'undefined') return;

    if (isSpeaking && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      return;
    }

    window.speechSynthesis.cancel(); // Clear any queued speech

    // Formulate reading content
    const textToRead = `${activeStory.title}. 오늘의 주인공 ${name}의 잠자리 동화를 들려줄게. ${activeStory.body}`;
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
      setIsSpeaking(false);
      setIsPaused(false);
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
      body: item.body
    });
    // Scroll smoothly to book viewport on mobile
    const bookEl = document.getElementById('storybook');
    if (bookEl) {
      bookEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const deleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Avoid selecting when clicking delete
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem('tales_history', JSON.stringify(updated));
  };

  return (
    <div className="relative min-h-screen pb-20">
      {/* Night Sky Background */}
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
        {/* App Title Header */}
        <header className="app-header">
          <h1 className="app-title">달콤한 꿈나라 🌙</h1>
          <p className="app-subtitle">매일 밤 우리 아이에게 들려주는 세상 하나뿐인 AI 잠자리 동화</p>
        </header>

        {/* Left Panel: Inputs Form */}
        <section className="form-card glass-panel">
          <h2 className="input-label" style={{ fontSize: '1.6rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
            <Sparkles className="text-secondary" size={24} /> 
            아름다운 이야기 설정
          </h2>

          <form onSubmit={handleGenerate} className="flex flex-col gap-6">
            {/* 1. Name Input */}
            <div className="input-group">
              <label htmlFor="child-name" className="input-label">
                <User size={18} className="text-primary" />
                아이의 이름
              </label>
              <p className="input-desc">동화 속 멋지고 지혜로운 주인공이 됩니다.</p>
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

            {/* 2. Interest Preset & Input */}
            <div className="input-group">
              <label htmlFor="child-interest" className="input-label">
                <Compass size={18} className="text-accent" />
                사랑하는 관심사
              </label>
              <p className="input-desc">아이가 흥미를 가질 만한 모험 소재를 고르거나 적어주세요.</p>
              <input
                id="child-interest"
                type="text"
                className="text-input"
                placeholder="예: 귀여운 아기 고양이, 하늘을 날으는 마법 침대"
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

            {/* 3. Lesson Preset & Input */}
            <div className="input-group">
              <label htmlFor="child-lesson" className="input-label">
                <Heart size={18} className="text-primary" />
                나누고 싶은 교훈
              </label>
              <p className="input-desc">따뜻한 교훈이 이야기의 감동과 얽혀 전달됩니다.</p>
              <input
                id="child-lesson"
                type="text"
                className="text-input"
                placeholder="예: 정리정돈 잘하기, 양치질 즐겁게 하기"
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

            {/* Generate Button */}
            <button 
              type="submit" 
              className="story-btn" 
              disabled={isLoading || !name || !interest || !lesson}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="animate-spin" size={24} />
                  마법 이야기 구성 중...
                </>
              ) : (
                <>
                  <Sparkles size={24} />
                  마법 동화책 펼치기
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
                생성 멈추기
              </button>
            )}
          </form>
        </section>

        {/* Right Panel: Storybook View */}
        <section id="storybook" className="book-panel glass-panel">
          {isLoading && !activeStory ? (
            <div className="story-placeholder">
              <div className="placeholder-illustration">📚</div>
              <h3 className="app-title" style={{ fontSize: '2rem' }}>신비한 잉크가 채워지는 중...</h3>
              <p style={{ color: 'var(--color-text-secondary)', maxWidth: '400px', lineHeight: '1.6' }}>
                LM Studio의 로컬 AI 요정이 열심히 종이에 아름다운 동화를 적고 있어요. 조금만 기다리면 멋진 책이 펼쳐집니다.
              </p>
              <div className="loading-wave">
                <div className="loading-dot" />
                <div className="loading-dot" />
                <div className="loading-dot" />
                <div className="loading-dot" />
              </div>
            </div>
          ) : activeStory ? (
            <div className="flex flex-col h-full">
              {/* TTS Audio Player Bar */}
              {!isLoading && (
                <div className="audio-bar">
                  <div className="audio-controls">
                    <button 
                      className={`audio-btn ${isSpeaking && !isPaused ? 'active' : ''}`}
                      onClick={handleStartSpeaking}
                      title="동화 들려주기"
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
                          title="낭독 중단"
                        >
                          <Square size={18} />
                        </button>
                      </>
                    )}
                  </div>
                  
                  <div className="audio-status">
                    <Volume2 size={16} className="text-accent animate-pulse" />
                    <span>{isSpeaking ? (isPaused ? '자장가처럼 대기 중' : '꿀 보이스 낭독 중...') : '아이에게 소리로 들려주세요'}</span>
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
                          setTimeout(() => {
                            if (!activeStory || typeof window === 'undefined') return;
                            const textToRead = `${activeStory.title}. 오늘의 주인공 ${name}의 잠자리 동화를 들려줄게. ${activeStory.body}`;
                            const cleanText = textToRead.replace(/[#*\[\]]/g, '').trim();

                            const utterance = new SpeechSynthesisUtterance(cleanText);
                            utterance.lang = 'ko-KR';
                            utterance.rate = newRate;

                            if (selectedVoice) {
                              utterance.voice = selectedVoice;
                            }

                            utterance.onend = () => {
                              setIsSpeaking(false);
                              setIsPaused(false);
                            };

                            utterance.onerror = () => {
                              setIsSpeaking(false);
                              setIsPaused(false);
                            };

                            window.speechSynthesis.speak(utterance);
                            setIsSpeaking(true);
                            setIsPaused(false);
                          }, 100);
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
              )}

              {/* Live Streaming indicator */}
              {isLoading && (
                <div className="flex items-center gap-2 text-accent text-sm mb-4 bg-accent/10 border border-accent/20 px-3 py-1 rounded-full w-max">
                  <RefreshCw className="animate-spin" size={14} />
                  <span>실시간으로 동화가 작성되고 있습니다...</span>
                </div>
              )}

              {/* Story Header */}
              <div className="story-header">
                <div className="story-meta">
                  <span className="story-meta-pill">주인공: {name || '아이'}</span>
                  <span className="story-meta-pill">별나라 이야기</span>
                </div>
                <h2 className="story-title">✨ {activeStory.title}</h2>
              </div>

              {/* Story Body */}
              <div className="story-body">
                {activeStory.body ? (
                  activeStory.body.split('\n\n').map((paragraph, index) => (
                    <p key={index}>{paragraph.trim()}</p>
                  ))
                ) : (
                  <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>이야기 첫 마디를 적는 중...</p>
                )}
              </div>
            </div>
          ) : (
            <div className="story-placeholder">
              <div className="placeholder-illustration">⭐</div>
              <h3 className="app-title" style={{ fontSize: '2rem' }}>꿈나라 동화책</h3>
              <p style={{ color: 'var(--color-text-secondary)', maxWidth: '350px', lineHeight: '1.6' }}>
                왼쪽 양식에 아이의 이름과 관심사를 적어 넣고, <b>'마법 동화책 펼치기'</b>를 눌러 보세요.
                아이에게 평생 간직할 예쁜 꿈을 선물해 줄 수 있습니다.
              </p>
            </div>
          )}
        </section>

        {/* Bottom Section: Story History Vault */}
        <section className="history-section">
          <h2 className="history-title">
            <History className="text-secondary" size={24} />
            우리 아이 꿈나라 보관함
          </h2>

          {history.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <BookOpen size={48} style={{ margin: '0 auto 15px', opacity: 0.3 }} />
              <p>아직 보관된 동화가 없어요. 첫 번째 동화를 지어보세요!</p>
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
                  <p className="history-card-desc">{item.body}</p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: 'auto' }}>
                    <span className="story-meta-pill" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>주인공: {item.name}</span>
                    <span className="story-meta-pill" style={{ fontSize: '0.75rem', padding: '2px 8px', borderColor: 'rgba(56,189,248,0.2)', color: 'var(--color-accent)', background: 'rgba(56,189,248,0.05)' }}>
                      #{item.interest.slice(0, 10)}
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
