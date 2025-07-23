"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { SendHorizonal, FileUp, Trash2 } from "lucide-react";

interface Message {
  id: number;
  sender: 'user' | 'ai' | 'file';
  content: string;
}

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

const GEMINI_API_KEY = "AIzaSyAknYPjPTd1HAxlFP6yRHsRFNz3KcshKLw";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsedPdfText, setParsedPdfText] = useState<string>('');
  const [pdfMessageId, setPdfMessageId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js";
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
    };
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatMessagesForGemini = (): any[] => {
    return messages
      .filter((msg) => msg.sender !== 'file')
      .map((msg) => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));
  };

  const cleanText = (text: string): string => {
    return text.replace(/\*/g, '').replace(/[_`~>#+\-]/g, '').trim();
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: Message = {
      id: Date.now(),
      sender: 'user',
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    const typingMessage: Message = {
      id: Date.now() + 1,
      sender: 'ai',
      content: 'Typing...',
    };
    setMessages((prev) => [...prev, typingMessage]);

    try {
      const fullUserMessage = parsedPdfText
        ? `${trimmed}\n\n(PDF Content Below)\n${parsedPdfText}`
        : trimmed;

      const response = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            ...formatMessagesForGemini(),
            {
              role: 'user',
              parts: [{ text: fullUserMessage }],
            },
          ],
        }),
      });

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't understand that.";
      const aiText = cleanText(rawText);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === typingMessage.id ? { ...msg, content: aiText } : msg
        )
      );
    } catch (err) {
      console.error("API Error:", err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === typingMessage.id
            ? { ...msg, content: "Error contacting Gemini API. Please try again later." }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') sendMessage();
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== "application/pdf") return;

    const id = Date.now();
    const fileMsg: Message = {
      id,
      sender: 'file',
      content: `📄 Uploaded: ${file.name}`,
    };
    setMessages((prev) => [...prev, fileMsg]);
    setPdfMessageId(id);

    const reader = new FileReader();
    reader.onload = async () => {
      const typedArray = new Uint8Array(reader.result as ArrayBuffer);
      const pdf = await window.pdfjsLib.getDocument({ data: typedArray }).promise;

      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += `\n${pageText}`;
      }

      console.log("📄 Parsed PDF Content:\n", fullText);
      setParsedPdfText(fullText);
    };

    reader.readAsArrayBuffer(file);
  };

  const clearPdf = () => {
    setParsedPdfText('');
    setPdfMessageId(null);
    setMessages((prev) => prev.filter((msg) => msg.id !== pdfMessageId));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <div className="w-full max-w-2xl h-[80vh] bg-gradient-to-r from-emerald-500 via-cyan-500 to-indigo-500 p-[2px] rounded-2xl shadow-2xl">
        <Card className="w-full h-full flex flex-col bg-gradient-to-br from-[#1e1e2f] to-[#2e2e48] rounded-2xl">
          <CardContent className="flex flex-col gap-2 flex-1 overflow-hidden p-4">
            <h1 className="text-3xl font-extrabold text-center mb-1 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 underline decoration-cyan-400 decoration-2 tracking-wide">
              My GenAiChatBot
            </h1>
            <h5 className="text-center text-white text-sm mb-3">made by Bikram</h5>

            <ScrollArea className="flex-1 overflow-y-auto">
              <div className="flex flex-col gap-3 pr-2">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "max-w-[75%] p-3 rounded-xl text-sm text-white shadow-md",
                      msg.sender === 'user'
                        ? 'bg-gradient-to-br from-fuchsia-500 to-rose-500 self-end'
                        : msg.sender === 'ai'
                        ? 'bg-gradient-to-br from-emerald-500 to-lime-500 self-start'
                        : 'bg-blue-500 self-center'
                    )}
                  >
                    {msg.content}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <div className="flex items-center gap-2 pt-4">
              <Input
                type="text"
                placeholder="Type a message..."
                className="bg-gray-700 text-white placeholder:text-gray-400"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                onClick={triggerFileUpload}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3"
                title="Upload PDF File"
              >
                <FileUp className="w-5 h-5" />
              </Button>
              {parsedPdfText && (
                <Button
                  onClick={clearPdf}
                  className="bg-red-600 hover:bg-red-700 text-white px-3"
                  title="Delete PDF File"
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              )}
              <Button
                onClick={sendMessage}
                className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-3"
                disabled={loading}
              >
                <SendHorizonal className="w-5 h-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
