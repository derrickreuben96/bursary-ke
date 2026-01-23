import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAIChat } from "@/hooks/useAIChat";
import { HelpCircle, Send, Loader2, Bot, User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormAssistantProps {
  context?: string;
}

export function FormAssistant({ context = "" }: FormAssistantProps) {
  const [input, setInput] = useState("");
  const { messages, isLoading, error, sendMessage, clearMessages } = useAIChat("form");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    // Include context in the first message
    const messageWithContext = messages.length === 0 && context 
      ? `Context: ${context}\n\nQuestion: ${input.trim()}`
      : input.trim();
    
    sendMessage(messageWithContext);
    setInput("");
  };

  const quickQuestions = [
    "What documents do I need?",
    "How is poverty score calculated?",
    "What phone format should I use?",
  ];

  return (
    <Sheet onOpenChange={(open) => !open && clearMessages()}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-primary border-primary/30 hover:bg-primary/10"
        >
          <Sparkles className="h-4 w-4" />
          Need Help?
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Form Assistant
          </SheetTitle>
          <SheetDescription>
            Ask questions about filling out the application form
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 flex flex-col mt-4 min-h-0">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {/* Welcome message */}
              {messages.length === 0 && (
                <>
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-sm">
                        Hi! I'm here to help you fill out the bursary application form. 
                        Ask me about any field or requirement you're unsure about.
                      </p>
                    </div>
                  </div>

                  {/* Quick questions */}
                  <div className="pl-11 flex flex-wrap gap-2">
                    {quickQuestions.map((q, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="text-xs h-auto py-1.5"
                        onClick={() => sendMessage(q)}
                        disabled={isLoading}
                      >
                        {q}
                      </Button>
                    ))}
                  </div>
                </>
              )}

              {/* Messages */}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-3",
                    msg.role === "user" && "flex-row-reverse"
                  )}
                >
                  <div
                    className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                      msg.role === "user" ? "bg-primary" : "bg-primary/10"
                    )}
                  >
                    {msg.role === "user" ? (
                      <User className="h-4 w-4 text-primary-foreground" />
                    ) : (
                      <Bot className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div
                    className={cn(
                      "rounded-lg p-3 max-w-[85%]",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}

              {/* Loading */}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Error */}
          {error && (
            <div className="my-2 p-2 bg-destructive/10 text-destructive text-sm rounded">
              {error}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about the form..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
