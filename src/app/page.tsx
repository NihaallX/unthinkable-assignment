"use client";

import { useState, useRef, ChangeEvent, useEffect, useCallback } from "react";
import Image from "next/image";
import { UploadCloud, File, FileText, X, AlertCircle, Copy, Check, RotateCcw, Lightbulb, Send, MessageSquare, Bot } from "lucide-react";
import { Spinner } from "@/components/Spinner";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MIN_READABLE_TEXT_LENGTH = 50;
const COPY_FEEDBACK_TIMEOUT_MS = 2000;

type SummaryLength = "Short" | "Medium" | "Long";

interface SummaryData { 
  summary: string; 
  keyPoints: string[]; 
  improvements: string[]; 
  suggestedQuestions?: string[];
  truncated?: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: string[];
}

const DURATION = 0.3;
const DELAY = DURATION;
const EASE_OUT = "easeOut";
const EASE_OUT_OPACITY = [0.25, 0.46, 0.45, 0.94] as const;

export default function DocumentSummaryAssistant() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [summaryLength, setSummaryLength] = useState<SummaryLength>("Medium");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputBarRef = useRef<HTMLDivElement>(null);
  const [inputBarHeight, setInputBarHeight] = useState(0);

  const validateAndSetFile = useCallback((selectedFile: File) => {
    setErrorMsg("");
    if (selectedFile.size > MAX_FILE_SIZE) {
      setErrorMsg("File size exceeds 10MB limit.");
      return;
    }
    if (ACCEPTED_TYPES.includes(selectedFile.type) || 
        selectedFile.name.toLowerCase().match(/\.(pdf|png|jpe?g)$/)) {
      setFile(selectedFile);
    } else {
      setErrorMsg("Please upload a valid .pdf, .png, or .jpg/.jpeg file.");
    }
  }, []);

  useEffect(() => {
    if (!inputBarRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setInputBarHeight(entry.contentRect.height);
      }
    });
    resizeObserver.observe(inputBarRef.current);
    return () => resizeObserver.disconnect();
  }, [summaryData]);

  useEffect(() => {
    if (chatHistory.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, isChatLoading]);

  const dragCounter = useRef(0);

  useEffect(() => {
    const handleWindowDragEnter = (e: globalThis.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current += 1;
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    };

    const handleWindowDragLeave = (e: globalThis.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current -= 1;
      if (dragCounter.current === 0) {
        setIsDragging(false);
      }
    };

    const handleWindowDragOver = (e: globalThis.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleWindowDrop = (e: globalThis.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);
      
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        validateAndSetFile(e.dataTransfer.files[0]);
      }
    };

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [validateAndSetFile]);

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleStartOver = () => {
    setFile(null);
    setSummaryData(null);
    setExtractedText("");
    setChatHistory([]);
    setChatInput("");
    setChatError("");
    setErrorMsg("");
    setIsCopied(false);
  };

  const handleCopy = async () => {
    if (!summaryData) return;
    const text = `Summary:\n${summaryData.summary}\n\nKey Points:\n${summaryData.keyPoints.map(p => `- ${p}`).join('\n')}`;
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), COPY_FEEDBACK_TIMEOUT_MS);
    } catch (err) {
      console.error("Copy failed:", err);
      setErrorMsg("Couldn't copy to clipboard — please copy manually.");
    }
  };

  const handleGenerateSummary = async () => {
    if (!file) return;

    setIsExtracting(true);
    setSummaryData(null);
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const endpoint = file.type === "application/pdf" ? "/api/extract-pdf" : "/api/extract-image";

      const extractRes = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!extractRes.ok) {
        const err = await extractRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to extract text");
      }

      const extractData = await extractRes.json();
      const text = extractData.text;
      setExtractedText(text);

      if (!text || text.trim().length < MIN_READABLE_TEXT_LENGTH) {
        throw new Error("Could not extract readable text from this document");
      }
      
      setIsExtracting(false);
      setIsSummarizing(true);

      const sumRes = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, length: summaryLength }),
      });

      if (!sumRes.ok) {
        const err = await sumRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate summary");
      }

      const sumData = await sumRes.json();
      setSummaryData(sumData);
    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error ? error.message : "An error occurred during processing.";
      setErrorMsg(message);
    } finally {
      setIsExtracting(false);
      setIsSummarizing(false);
    }
  };

  const handleChatSubmit = async (questionText: string) => {
    if (!questionText.trim() || !extractedText) return;

    const newHistory = [...chatHistory, { role: "user" as const, content: questionText }];
    setChatHistory(newHistory);
    setChatInput("");
    setIsChatLoading(true);
    setChatError("");

    try {
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentText: extractedText,
          question: questionText,
          chatHistory: chatHistory
        }),
      });

      if (!chatRes.ok) {
        const err = await chatRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate chat response");
      }

      const chatData = await chatRes.json();
      setChatHistory([
        ...newHistory,
        { role: "assistant", content: chatData.answer, citations: chatData.citations }
      ]);
    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error ? error.message : "An error occurred during chat.";
      setChatError(message);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <main className={cn(
      "w-full font-sans flex flex-col transition-all",
      summaryData ? "h-[100dvh] overflow-hidden" : "min-h-[100dvh]"
    )}>
      {/* Pinned Header */}
      <header className="shrink-0 sticky top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-md z-40 flex items-center px-6 md:px-8 border-b border-border/50 shadow-sm">
        <Image 
          src="/logo.png" 
          alt="Document Summary Assistant Logo" 
          width={32} 
          height={32} 
          className="rounded-md mr-3 shadow-sm"
          priority
        />
        <h1 className="font-serif text-xl italic font-bold text-foreground">
          Document Summary
        </h1>
      </header>

      {/* Main Content Area */}
      <div className={cn("flex-1 w-full flex flex-col relative min-h-0", !summaryData && "p-inset")}>
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm pointer-events-none p-6 md:p-12"
            >
              <div className="w-full h-full border-4 border-dashed border-primary/50 rounded-[40px] flex flex-col items-center justify-center bg-primary/5">
                <div className="bg-background/90 backdrop-blur-xl p-8 md:p-12 rounded-3xl shadow-2xl flex flex-col items-center text-center border border-border/50">
                  <UploadCloud className="w-16 h-16 text-primary mb-4 animate-bounce" />
                  <h2 className="text-2xl font-bold text-foreground">Drop your document anywhere</h2>
                  <p className="text-foreground/70 mt-2">Release to upload and summarize</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={cn(
          "relative flex flex-col flex-1 w-full overflow-hidden min-h-0",
          !summaryData ? "items-center rounded-[42px] md:rounded-[72px] bg-gradient-primary p-sides py-12 lg:py-24" : ""
        )}>
          
          <div className={cn(
            "flex flex-col min-w-0 w-full shrink z-10 relative min-h-0",
            !summaryData ? "items-center max-w-2xl" : "flex-1 h-full"
          )}>
          
          <AnimatePresence mode="popLayout">
            {errorMsg && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: DURATION, ease: EASE_OUT_OPACITY } }}
                transition={{ duration: DURATION, ease: EASE_OUT }}
                className={cn("w-full mb-6", summaryData && "p-4 md:p-8")}
              >
                <Alert variant="destructive" className="backdrop-blur-xl bg-destructive/10 border-destructive/30">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription className="flex items-center justify-between">
                    {errorMsg}
                    <button onClick={() => setErrorMsg("")} className="ml-4 p-2 min-w-[44px] min-h-[44px] hover:text-white transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}

            {!summaryData && (
              <motion.div
                key="upload-zone"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: DURATION, ease: EASE_OUT_OPACITY } }}
                transition={{ duration: DURATION, ease: EASE_OUT }}
                className="w-full"
              >
                <Card className="backdrop-blur-xl bg-primary/10 border-2 border-border/20 shadow-button p-6 rounded-3xl w-full">
                  <CardContent className="p-0">
                    {/* Upload Dropzone */}
                    <div
                      className={cn(
                        "relative group flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-2xl transition-all cursor-pointer",
                        isDragging 
                          ? "border-primary bg-primary/20" 
                          : "border-border/30 hover:border-primary/50 hover:bg-primary/5",
                        file && "hidden"
                      )}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadCloud className={cn(
                        "w-10 h-10 mb-4 transition-colors",
                        isDragging ? "text-primary" : "text-foreground/50 group-hover:text-primary"
                      )} />
                      <p className="text-sm font-medium text-foreground">
                        <span className="text-primary font-bold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-foreground/50 mt-2">
                        PDF, PNG, JPG (max. 10MB)
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                        onChange={handleFileInput}
                      />
                    </div>

                    {/* Selected File */}
                    {file && (
                      <div className="flex items-center justify-between p-4 mb-6 bg-primary/20 border border-border/30 rounded-2xl">
                        <div className="flex items-center space-x-4 overflow-hidden">
                          <div className="p-2 bg-primary/20 text-primary rounded-xl flex-shrink-0">
                            <File className="w-6 h-6" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-sm font-medium text-foreground truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-foreground/70 mt-0.5">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setFile(null)}
                          className="p-2 text-foreground/50 hover:text-foreground hover:bg-foreground/10 rounded-full transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    )}

                    {/* Settings & Actions */}
                    <div className="space-y-6 mt-6">
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-foreground">
                          Summary Length
                        </label>
                        <div className="flex p-1 bg-background/20 backdrop-blur-md rounded-xl border border-border/10">
                          {(["Short", "Medium", "Long"] as const).map((length) => (
                            <button
                              key={length}
                              onClick={() => setSummaryLength(length)}
                              className={cn(
                                "flex-1 py-2 min-h-[44px] text-sm font-medium rounded-lg transition-all",
                                summaryLength === length
                                  ? "bg-primary text-primary-foreground shadow-sm"
                                  : "text-foreground/70 hover:text-foreground hover:bg-foreground/5"
                              )}
                            >
                              {length}
                            </button>
                          ))}
                        </div>
                      </div>

                      <Button
                        disabled={!file || isExtracting || isSummarizing}
                        onClick={handleGenerateSummary}
                        size="lg"
                        className="w-full relative px-8 py-6 rounded-xl text-base shadow-button"
                        shine={!isExtracting && !isSummarizing}
                      >
                        {(isExtracting || isSummarizing) ? (
                          <span className="flex items-center space-x-2">
                            <Spinner />
                            <span>{isExtracting ? "Extracting text..." : "Generating summary..."}</span>
                          </span>
                        ) : (
                          "Generate Summary"
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Results Two-Zone Layout Component */}
            {summaryData && (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DURATION, ease: EASE_OUT, delay: DELAY }}
                className="w-full h-full flex flex-col relative min-h-0"
              >
                {/* Zone 1: Scrollable Content */}
                <div 
                  className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth"
                  style={{ paddingBottom: inputBarHeight ? `${inputBarHeight + 24}px` : "120px" }}
                >
                  <div className="max-w-4xl mx-auto space-y-8">
                    {summaryData.truncated && (
                      <Alert className="backdrop-blur-xl bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Warning</AlertTitle>
                        <AlertDescription>
                          This document was extremely long, so only the first ~12,000 characters were summarized.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {/* Summary Cards */}
                    <Card className="backdrop-blur-xl bg-primary/5 border-2 border-border/30 shadow-sm p-6 rounded-3xl overflow-hidden">
                      <CardContent className="p-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                          <h2 className="text-xl font-serif italic text-foreground flex items-center space-x-2">
                            <FileText className="w-5 h-5 text-primary" />
                            <span>Analysis Result</span>
                          </h2>
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm" onClick={handleCopy} className="bg-transparent border border-border/30 hover:bg-white/10 text-foreground">
                              {isCopied ? <><Check className="w-4 h-4 mr-2 text-success" /> Copied!</> : <><Copy className="w-4 h-4 mr-2" /> Copy</>}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleStartOver} className="bg-transparent border border-border/30 hover:bg-white/10 text-foreground">
                              <RotateCcw className="w-4 h-4 mr-2" /> Start Over
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-8">
                          <div>
                            <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Summary</h3>
                            <p className="text-sm md:text-base text-foreground/90 leading-relaxed text-balance">
                              {summaryData.summary}
                            </p>
                          </div>

                          {summaryData.keyPoints && summaryData.keyPoints.length > 0 && (
                            <div>
                              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Key Points</h3>
                              <ul className="space-y-3">
                                {summaryData.keyPoints.map((point, idx) => (
                                  <li key={idx} className="flex items-start space-x-3 text-sm md:text-base text-foreground/90 leading-relaxed text-balance">
                                    <span className="block mt-2 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                                    <span>{point}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {summaryData.improvements && summaryData.improvements.length > 0 && (
                            <div className="pt-6 border-t border-border/20">
                              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                                <Lightbulb className="w-4 h-4" />
                                <span>Suggestions for Improvement</span>
                              </h3>
                              <ul className="space-y-3">
                                {summaryData.improvements.map((point, idx) => (
                                  <li key={idx} className="flex items-start space-x-3 text-sm md:text-base text-foreground/90 leading-relaxed text-balance">
                                    <span className="block mt-2 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                                    <span>{point}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Chat Messages Section */}
                    {extractedText && (
                      <div className="pt-8 space-y-6">
                        <div className="flex items-center space-x-2 pb-4 border-b border-border/20">
                          <MessageSquare className="w-5 h-5 text-primary" />
                          <h2 className="font-serif italic font-bold text-lg text-foreground">Document Q&A</h2>
                        </div>
                        
                        {chatHistory.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-foreground/50 space-y-4 text-center">
                            <Bot className="w-12 h-12 text-primary/30" />
                            <p>Ask a question about the document.</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {chatHistory.map((msg, idx) => (
                              <div key={idx} className={cn("flex w-full", msg.role === "user" ? "justify-end" : "justify-start")}>
                                <div className={cn(
                                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm md:text-base leading-relaxed text-balance shadow-sm",
                                  msg.role === "user" 
                                    ? "bg-primary text-primary-foreground rounded-tr-sm" 
                                    : "bg-background border border-border/30 text-foreground rounded-tl-sm"
                                )}>
                                  <p>{msg.content}</p>
                                  {msg.citations && msg.citations.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                      {msg.citations.map((cite, cIdx) => (
                                        <blockquote key={cIdx} className="text-xs border-l-2 border-primary/50 pl-2 text-foreground/70 italic bg-primary/5 py-1 px-2 rounded-r-md">
                                          &quot;{cite}&quot;
                                        </blockquote>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {isChatLoading && (
                          <div className="flex w-full justify-start">
                            <div className="bg-background border border-border/30 rounded-2xl rounded-tl-sm px-4 py-3 text-foreground/70 flex items-center space-x-2 shadow-sm">
                              <Spinner />
                              <span className="text-sm">Thinking...</span>
                            </div>
                          </div>
                        )}
                        
                        <div ref={messagesEndRef} className="h-4" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Zone 2: Fixed Input Bar */}
                {extractedText && (
                  <div 
                    ref={inputBarRef}
                    className="absolute bottom-0 left-0 right-0 bg-background/90 backdrop-blur-xl border-t border-border/20 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]"
                  >
                    <div className="max-w-4xl mx-auto w-full p-4 space-y-3">
                      {/* Suggested Questions */}
                      {chatHistory.length === 0 && summaryData.suggestedQuestions && summaryData.suggestedQuestions.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {summaryData.suggestedQuestions.map((q, idx) => (
                            <button 
                              key={idx}
                              onClick={() => handleChatSubmit(q)}
                              className="text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors px-3 py-1.5 rounded-full text-left shadow-sm"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Chat Error */}
                      {chatError && (
                        <div className="text-xs text-destructive flex items-center space-x-1 bg-destructive/10 px-3 py-2 rounded-lg">
                          <AlertCircle className="w-3 h-3" />
                          <span>{chatError}</span>
                        </div>
                      )}

                      {/* Input Bar Form */}
                      <form 
                        onSubmit={(e) => { e.preventDefault(); handleChatSubmit(chatInput); }}
                        className="flex items-center space-x-2 relative"
                      >
                        <input 
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Ask anything about this document..."
                          disabled={isChatLoading}
                          className="flex-1 bg-background border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                        />
                        <Button 
                          type="submit" 
                          disabled={!chatInput.trim() || isChatLoading}
                          size="icon"
                          className="h-[46px] w-[46px] rounded-xl shrink-0 shadow-button"
                        >
                          <Send className="w-5 h-5" />
                        </Button>
                      </form>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          
          </div>
        </div>
      </div>
    </main>
  );
}
