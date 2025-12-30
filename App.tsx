import React, { useState, useRef, useEffect } from 'react';
import { PROFILES } from './constants';
import { LearningProfile } from './types';
import { adaptContent, generateSpeech, AdaptationResult } from './services/geminiService';
import { decodeBase64, decodeAudioData } from './utils/audioUtils';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const LogoIcon = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={`${className} fill-none stroke-current`} xmlns="http://www.w3.org/2000/svg">
    <path strokeWidth="3" strokeLinecap="round" d="M35 45c0-12 8-20 15-20s15 8 15 20c0 6-2 12-6 16M42 61c-4-3-7-8-7-16" />
    <path strokeWidth="2" strokeLinecap="round" d="M50 25v15M40 35h20M45 40h10" />
    <path strokeWidth="2.5" strokeLinecap="round" d="M50 50v20M50 70c-4 2-8 6-10 12M50 70c4 2 8 6 10 12M50 72v10M45 75c-3 3-5 7-5 10M55 75c3 3 5 7 5 10" />
    <circle cx="50" cy="50" r="48" strokeOpacity="0.1" strokeWidth="1" />
  </svg>
);

const ChatBotAvatar = () => (
  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center relative shadow-sm border border-[#E1BEE7] p-1">
    <svg viewBox="0 0 100 100" className="w-full h-full text-[#BA68C8] fill-current" xmlns="http://www.w3.org/2000/svg">
      {/* Friendly Pink/Purple Brain */}
      <path d="M50 25c-12 0-22 8-22 20 0 4 1 8 3 11-1 1-2 2-2 4 0 4 3 7 7 7 1 0 2 0 3-1 3 3 7 5 11 5s8-2 11-5c1 1 2 1 3 1 4 0 7-3 7-7 0-2-1-3-2-4 2-3 3-7 3-11 0-12-10-20-22-20z" />
      {/* Tiny Green Leaf */}
      <path d="M55 22 Q60 15 65 20 Q60 25 55 22" fill="#81C784" />
      {/* Eyes and Smile */}
      <circle cx="42" cy="45" r="3" fill="white" />
      <circle cx="58" cy="45" r="3" fill="white" />
      <path d="M44 54 Q50 58 56 54" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  </div>
);

const App: React.FC = () => {
  const [selectedProfile, setSelectedProfile] = useState<LearningProfile>(LearningProfile.ADHD);
  const [inputUrl, setInputUrl] = useState('');
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [fileData, setFileData] = useState<{ data: string; mimeType: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<AdaptationResult | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [showMission, setShowMission] = useState(false);
  
  // Chatbot State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([
    { role: 'bot', text: "Hi! I'm your Cognitive Ally. I'm here to help you understand things at your own pace. Ready to explore together?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const currentProfileInfo = PROFILES.find(p => p.id === selectedProfile);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isBotTyping]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        setFileData({ data: base64, mimeType: file.type });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdapt = async () => {
    if (!inputText && !fileData && !inputUrl && !searchQuery) {
      alert("Please provide content, a URL, or a search topic.");
      return;
    }
    setIsProcessing(true);
    setResult(null);
    try {
      let contentToProcess = searchQuery || (inputUrl ? `Process content from this URL: ${inputUrl}. ${inputText}` : inputText);
      const res = await adaptContent(contentToProcess, selectedProfile, {
        imageData: fileData || undefined,
        isSearch: !!searchQuery
      });
      setResult(res);
    } catch (error) {
      console.error(error);
      alert("Error processing content. Ensure the text is extracted correctly.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async (customMsg?: string) => {
    const msg = customMsg || chatInput;
    if (!msg.trim()) return;

    const newMsgs = [...chatMessages, { role: 'user' as const, text: msg }];
    setChatMessages(newMsgs);
    setChatInput('');
    setIsBotTyping(true);

    try {
      const contextText = result?.text || inputText || "The user hasn't loaded any specific text yet.";
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          { role: 'user', parts: [{ text: `CONTEXT CONTENT:\n${contextText}\n\nUSER QUESTION: ${msg}` }] }
        ],
        config: {
          systemInstruction: "You are 'Cognitive Ally', a friendly, patient, and encouraging AI companion for neurodivergent learners. Tone: encouraging, simple, and patient. Avoid complex metaphors. When a user asks for 'Explain simply', summarize the context content in exactly 3 short, easy-to-read bullet points. When a user asks to 'Define terms', find the most complex words in the context and provide a very simple definition for each. If they ask for a 'Check-in', ask if they need a 2-minute break to avoid cognitive overload. When a user asks for a 'Quiz', generate 5 multiple-choice or short-answer questions based on the provided context. Make it friendly. Use clear, accessible language at all times. Keep responses relatively brief and supportive.",
          temperature: 0.7,
        }
      });

      setChatMessages([...newMsgs, { role: 'bot', text: response.text || "I'm listening, but I didn't quite catch that. Could you say it again simply?" }]);
    } catch (err) {
      console.error(err);
      setChatMessages([...newMsgs, { role: 'bot', text: "I'm sorry, I had a little trouble thinking just now. Let's try again!" }]);
    } finally {
      setIsBotTyping(false);
    }
  };

  const handleReadAloud = async () => {
    if (!result?.text || isSpeaking) return;
    setIsSpeaking(true);
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const audioBase64 = await generateSpeech(result.text);
      if (audioBase64) {
        const bytes = decodeBase64(audioBase64);
        const buffer = await decodeAudioData(bytes, audioContextRef.current);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setIsSpeaking(false);
        source.start();
      }
    } catch (error) {
      console.error(error);
      setIsSpeaking(false);
    }
  };

  const exportAsFile = (format: 'txt' | 'md' | 'pdf') => {
    if (!result?.text) return;
    const fileName = `NeuroPath_Adapted_${selectedProfile}_${new Date().getTime()}`;
    if (format === 'txt' || format === 'md') {
      const extension = format === 'txt' ? '.txt' : '.md';
      const content = format === 'md' ? `# NeuroPath Adapted Content\n\n${result.text}` : result.text;
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName + extension;
      link.click();
      URL.revokeObjectURL(url);
    } else if (format === 'pdf') {
      const { jsPDF } = (window as any).jspdf;
      const doc = new jsPDF();
      doc.text(doc.splitTextToSize(result.text, 180), 15, 35);
      doc.save(`${fileName}.pdf`);
    }
    setIsExportMenuOpen(false);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#FAF9F6] text-[#36454F]">
      {/* Sidebar */}
      <aside className="w-full md:w-80 bg-white border-r border-[#E8E6DF] p-6 flex flex-col gap-6 relative z-10">
        <div className="flex items-center gap-4 mb-4 group cursor-pointer">
          <div className="relative w-16 h-16 flex items-center justify-center bg-[#36454F] rounded-full text-white overflow-hidden shadow-xl">
            <LogoIcon className="w-12 h-12" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-black tracking-tight text-[#36454F] leading-none">NeuroPath</h1>
            <span className="text-[11px] font-bold text-[#967BB6] uppercase tracking-widest mt-1">Your cognitive ally</span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Profiles</h2>
          {PROFILES.map((profile) => (
            <button
              key={profile.id}
              onClick={() => setSelectedProfile(profile.id)}
              className={`flex items-start gap-4 p-4 rounded-2xl transition-all border-2 text-left ${
                selectedProfile === profile.id ? `border-[#967BB6] bg-[#F3E5F5] shadow-sm` : 'border-transparent hover:bg-[#FAF9F6]'
              }`}
            >
              <div className={`mt-1 p-2 rounded-lg text-white ${profile.color} shadow-sm`}>
                <i className={`fas ${profile.icon}`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-[#36454F] truncate">{profile.name}</h3>
                <p className="text-xs text-slate-500 leading-tight mt-1">{profile.description}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-auto p-4 bg-[#FAF9F6] rounded-xl border border-[#E8E6DF]">
          <p className="text-xs text-slate-500 leading-relaxed italic">
            "Aligning information to the architecture of your mind."
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-10 flex flex-col gap-8 max-w-5xl mx-auto w-full relative">
        
        {/* Hero Section */}
        <section className="bg-[#E6E6FA] p-8 md:p-12 rounded-[2.5rem] border border-[#D1D1EB] shadow-sm relative overflow-hidden">
          <div className="relative z-10 flex flex-col gap-4 max-w-2xl">
            <h2 className="text-4xl md:text-5xl font-black text-[#36454F] leading-tight">
              NeuroPath: <span className="text-[#967BB6]">Aligning the World</span> to How You Think.
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <button 
                onClick={() => setShowMission(!showMission)}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#967BB6] shadow-sm hover:scale-110 transition-transform cursor-pointer"
              >
                <i className={`fas ${showMission ? 'fa-times' : 'fa-info'}`}></i>
              </button>
              <span className="text-sm font-medium text-slate-600">Discover our mission</span>
            </div>
          </div>
          {showMission && (
            <div className="mt-6 p-6 bg-white rounded-3xl border border-[#E8E6DF] shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
              <h3 className="text-xl font-bold mb-4 text-[#36454F] border-b pb-2">The Mission</h3>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-rose-500 mb-2">The Challenge</h4>
                  <p className="text-sm text-slate-600">Cognitive walls for neurodivergent learners: Traditional learning materials are designed for a 'neurological average.' For the 20% of the population with ADHD, Dyslexia, or Autism, dense text and rigid formatting create a 'cognitive wall'.</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[#967BB6] mb-2">The Solution</h4>
                  <p className="text-sm text-slate-600">AI-driven content re-architecting: NeuroPath leverages Gemini 3 Pro’s multimodal intelligence to dismantle that wall by instantly re-architecting content into sensory-specific profiles.</p>
                </div>
              </div>
            </div>
          )}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/30 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        </section>

        {/* Impact Spotlight (Maya) */}
        <section className="bg-white p-6 rounded-3xl border border-[#E8E6DF] shadow-sm">
          <div className="flex items-center gap-6">
            <div className="hidden sm:block w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 shadow-md border-4 border-[#FAF9F6]">
              <img 
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300&h=300" 
                alt="Maya" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col">
              <h4 className="text-xs font-bold uppercase tracking-widest text-[#967BB6] mb-1">Impact Spotlight</h4>
              <p className="text-[#36454F] text-sm leading-relaxed italic">
                "Meet Maya. Before NeuroPath, a 60-page legal brief was a brick wall. With our app, she can dismantle that wall by changing how the information is physically and logically presented to her brain."
              </p>
            </div>
          </div>
        </section>

        {/* Inputs */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-[#E8E6DF] shadow-sm flex flex-col gap-5">
            <div className="flex items-center gap-2 text-[#967BB6] font-medium">
              <i className="fas fa-search"></i>
              <h3>Search & Input</h3>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">Topic Search (AI Grounded)</label>
              <div className="relative">
                <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  type="text"
                  placeholder="e.g. Quantum Computing simplified"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#967BB6] outline-none transition-all bg-[#FAF9F6]"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value) { setInputUrl(''); setInputText(''); }
                  }}
                />
              </div>
            </div>
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-100"></div>
              <span className="flex-shrink mx-4 text-slate-300 text-xs font-bold uppercase tracking-widest">OR</span>
              <div className="flex-grow border-t border-slate-100"></div>
            </div>
            <textarea
              placeholder="Paste text here..."
              className="w-full h-24 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#967BB6] outline-none transition-all resize-none bg-[#FAF9F6]"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (e.target.value) setSearchQuery('');
              }}
            />
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">URL Source</label>
              <div className="relative">
                <i className="fas fa-link absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  type="url"
                  placeholder="https://..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#967BB6] outline-none transition-all bg-[#FAF9F6]"
                  value={inputUrl}
                  onChange={(e) => {
                    setInputUrl(e.target.value);
                    if (e.target.value) setSearchQuery('');
                  }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-[#E8E6DF] shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2 text-emerald-600 font-medium">
              <i className="fas fa-file-upload"></i>
              <h3>Document Upload</h3>
            </div>
            <div 
              className={`flex-1 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center p-8 transition-all ${
                fileData ? 'border-emerald-500 bg-emerald-50' : 'border-[#E8E6DF] hover:border-[#967BB6]'
              }`}
            >
              <input 
                type="file" 
                id="file-upload" 
                className="hidden" 
                onChange={handleFileChange} 
                accept="image/*,application/pdf,text/plain" 
              />
              <label htmlFor="file-upload" className="cursor-pointer text-center">
                <i className={`fas ${fileData ? 'fa-check-circle text-emerald-500' : 'fa-cloud-upload-alt text-slate-300'} text-4xl mb-4`}></i>
                <p className="font-medium text-slate-700">
                  {fileData ? "File Attached" : "Upload Image or Text"}
                </p>
                <p className="text-xs text-slate-400 mt-1">Ready for analysis</p>
              </label>
            </div>
            <button
              onClick={handleAdapt}
              disabled={isProcessing}
              className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 ${
                isProcessing 
                  ? 'bg-slate-300 cursor-not-allowed text-slate-500' 
                  : 'bg-[#36454F] hover:bg-slate-700 text-white transform hover:-translate-y-1 active:scale-95'
              }`}
            >
              {isProcessing ? (
                <>
                  <i className="fas fa-circle-notch fa-spin"></i>
                  Architecting...
                </>
              ) : (
                <>
                  <i className="fas fa-magic"></i>
                  Adapt Content
                </>
              )}
            </button>
          </div>
        </section>

        {/* Results Area */}
        {result && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className={`bg-white p-8 md:p-12 rounded-[2rem] border border-[#E8E6DF] shadow-xl relative ${
              selectedProfile === LearningProfile.DYSLEXIA ? 'border-[#967BB6] ring-4 ring-[#F3E5F5]' : ''
            }`}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                  <i className={`fas ${currentProfileInfo?.icon}`}></i>
                  <span>{currentProfileInfo?.name} Result</span>
                </div>
                
                <div className="flex gap-2 relative" ref={exportMenuRef}>
                  <button
                    onClick={handleReadAloud}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold transition-all shadow-md ${
                      isSpeaking 
                        ? 'bg-[#F3E5F5] text-[#967BB6]' 
                        : 'bg-slate-100 text-[#36454F] hover:bg-slate-200 active:scale-95'
                    }`}
                  >
                    <i className={`fas ${isSpeaking ? 'fa-volume-up animate-pulse' : 'fa-volume-up'}`}></i>
                    {isSpeaking ? 'Listening...' : 'Read Aloud'}
                  </button>
                  <button
                    onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold bg-[#36454F] text-white hover:bg-slate-700 shadow-md transition-all active:scale-95"
                  >
                    <i className="fas fa-download"></i>
                    Save
                  </button>

                  {isExportMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      <button onClick={() => exportAsFile('txt')} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 transition-colors border-b border-slate-100">
                        <i className="fas fa-file-alt text-slate-400"></i>
                        <span className="text-sm font-medium">Text (.txt)</span>
                      </button>
                      <button onClick={() => exportAsFile('pdf')} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 transition-colors">
                        <i className="fas fa-file-pdf text-rose-500"></i>
                        <span className="text-sm font-medium">PDF</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className={`prose prose-slate max-w-none ${selectedProfile === LearningProfile.DYSLEXIA ? 'dyslexic-font text-lg text-[#36454F]' : 'text-slate-800'}`}>
                {result.text.split('\n').map((para, i) => para.trim() ? (<p key={i} className="mb-4 whitespace-pre-wrap">{para}</p>) : <div key={i} className="h-4" />)}
              </div>
            </div>
          </section>
        )}

        {/* Cognitive Ally Chatbot Widget */}
        <div className="fixed bottom-6 right-6 flex flex-col items-end z-50 chatbot-text">
          {isChatOpen && (
            <div className="mb-4 w-[340px] md:w-[400px] h-[580px] bg-white/70 backdrop-blur-md border border-white/40 rounded-[2.5rem] shadow-[0_8px_32px_0_rgba(150,123,182,0.3)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
              {/* Glassmorphism Header */}
              <div className="p-5 bg-gradient-to-r from-[#F3E5F5]/60 to-[#E0F2F1]/60 border-b border-white/20 flex items-center justify-between backdrop-blur-lg">
                <div className="flex items-center gap-3">
                  <ChatBotAvatar />
                  <div>
                    <h5 className="font-bold text-[#4A148C] text-base">Cognitive Ally</h5>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-[#81C784] rounded-full animate-pulse"></div>
                      <span className="text-[10px] text-[#2E7D32] font-bold uppercase tracking-widest">Always Here</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="text-[#967BB6] hover:text-[#4A148C] p-2 transition-colors">
                  <i className="fas fa-times text-lg"></i>
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 scroll-smooth bg-white/20">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-[1.5rem] text-sm leading-relaxed shadow-sm transition-all ${
                      msg.role === 'user' 
                        ? 'bg-[#F3E5F5] text-[#4A148C] rounded-tr-none border border-[#E1BEE7]/50' 
                        : 'bg-[#E0F2F1] text-[#00695C] rounded-tl-none border border-[#B2DFDB]/50'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isBotTyping && (
                  <div className="flex justify-start">
                    <div className="bg-[#E0F2F1] px-4 py-3 rounded-[1.5rem] rounded-tl-none border border-[#B2DFDB]/50 shadow-sm flex gap-1.5 items-center">
                      <div className="w-1.5 h-1.5 bg-[#81C784] rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-[#81C784] rounded-full animate-bounce delay-75"></div>
                      <div className="w-1.5 h-1.5 bg-[#81C784] rounded-full animate-bounce delay-150"></div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Quick Actions - Refined Pill Buttons */}
              <div className="px-5 pb-3 flex flex-wrap gap-2 bg-white/20">
                <button 
                  onClick={() => handleSendMessage("Can you explain the main idea simply in 3 bullet points?")}
                  className="px-4 py-2 bg-white/80 backdrop-blur-md border border-[#E1BEE7] text-[#967BB6] text-xs font-bold rounded-full hover:bg-[#F3E5F5] transition-all shadow-sm flex items-center gap-1.5"
                >
                  <i className="fas fa-question-circle"></i>
                  Explain simply
                </button>
                <button 
                  onClick={() => handleSendMessage("Identify any complex words on the screen and explain them clearly.")}
                  className="px-4 py-2 bg-white/80 backdrop-blur-md border border-[#B2DFDB] text-[#00897B] text-xs font-bold rounded-full hover:bg-[#E0F2F1] transition-all shadow-sm flex items-center gap-1.5"
                >
                  <i className="fas fa-book"></i>
                  Define terms
                </button>
                <button 
                  onClick={() => handleSendMessage("I think I might need a break. Should I take 2 minutes?")}
                  className="px-4 py-2 bg-white/80 backdrop-blur-md border border-orange-100 text-orange-600 text-xs font-bold rounded-full hover:bg-orange-50 transition-all shadow-sm flex items-center gap-1.5"
                >
                  <i className="fas fa-clock"></i>
                  Check-in
                </button>
                <button 
                  onClick={() => handleSendMessage("Create a quiz of about 5 questions based on the reading for better learning.")}
                  className="px-4 py-2 bg-white/80 backdrop-blur-md border border-indigo-100 text-indigo-600 text-xs font-bold rounded-full hover:bg-indigo-50 transition-all shadow-sm flex items-center gap-1.5"
                >
                  <i className="fas fa-pencil-alt"></i>
                  Quiz
                </button>
              </div>

              {/* Chat Input */}
              <div className="p-5 bg-white/40 border-t border-white/20 flex gap-3 backdrop-blur-sm">
                <input
                  type="text"
                  placeholder="Ask me anything..."
                  className="flex-1 px-5 py-3 rounded-[1.2rem] border border-[#E1BEE7] focus:ring-2 focus:ring-[#BA68C8] outline-none text-sm bg-white/90 shadow-inner placeholder:text-[#967BB6]/60"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button 
                  onClick={() => handleSendMessage()}
                  className="w-12 h-12 bg-[#BA68C8] text-white rounded-[1.2rem] flex items-center justify-center hover:bg-[#9C27B0] transition-all active:scale-90 shadow-md"
                >
                  <i className="fas fa-paper-plane"></i>
                </button>
              </div>
            </div>
          )}
          
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`w-16 h-16 rounded-full shadow-[0_8px_30px_rgba(150,123,182,0.4)] flex items-center justify-center text-white transition-all transform hover:scale-110 active:scale-95 z-50 ${
              isChatOpen ? 'bg-rose-500' : 'bg-gradient-to-br from-[#BA68C8] to-[#4DB6AC] animate-pulse-soft'
            }`}
          >
            {isChatOpen ? (
              <i className="fas fa-times text-2xl"></i>
            ) : (
              <div className="relative">
                <i className="fas fa-comment-dots text-2xl"></i>
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white"></div>
              </div>
            )}
          </button>
        </div>
      </main>
      
      {/* Mobile Adaptation Action */}
      <div className="fixed bottom-6 left-6 md:hidden z-40">
         <button onClick={handleAdapt} className="w-16 h-16 bg-[#36454F] rounded-full text-white shadow-2xl flex items-center justify-center text-2xl">
            <i className="fas fa-magic"></i>
         </button>
      </div>
    </div>
  );
};

export default App;
