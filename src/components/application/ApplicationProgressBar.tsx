import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { useApplication } from "@/context/ApplicationContext";
import { computeCompletion, type CompletionSection } from "@/lib/application/completion";
import { LOGO_URL } from "@/lib/brandLogo";
import { useIsMobile } from "@/hooks/use-mobile";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, ChevronUp, Circle, Info } from "lucide-react";

interface Props {
  requiredDocsCount?: number;
  uploadedDocsCount?: number;
  className?: string;
  /** Hide the "What's left" checklist (e.g. on the confirmation modal). */
  showChecklist?: boolean;
  /** Force the static, non-animated variant regardless of OS preference. */
  forceStatic?: boolean;
  /** Optional heading override. */
  title?: string;
}

/**
 * Kenyan-flag themed completion meter.
 *
 * Accessibility notes:
 * - Colour is never the only signal: the fill carries a diagonal hatch
 *   pattern, the level is stated in words ("Almost done"), and a 4-block
 *   text gauge (■■■□) mirrors the percentage.
 * - The animated travelling logo collapses to a static marker when the user
 *   prefers reduced motion.
 * - Every section chip has a tooltip explaining what raises the meter there.
 */
export function ApplicationProgressBar({
  requiredDocsCount = 0,
  uploadedDocsCount = 0,
  className,
  showChecklist = true,
  forceStatic = false,
  title = "Application completeness",
}: Props) {
  const { data, liveParent, liveStudents } = useApplication();
  const isMobile = useIsMobile();
  const prefersReduced = useReducedMotion();
  const isStatic = forceStatic || prefersReduced;
  const [collapsed, setCollapsed] = useState(false);

  const result = useMemo(
    () => computeCompletion({ data, liveParent, liveStudents, requiredDocsCount, uploadedDocsCount }),
    [data, liveParent, liveStudents, requiredDocsCount, uploadedDocsCount]
  );

  const pct = result.percent;
  const level = result.level;
  const gauge = "■".repeat(level.steps) + "□".repeat(4 - level.steps);
  const motion = isStatic ? "" : "transition-all duration-500 ease-out";
  const done = pct >= 100;

  // Fire confetti once each time the meter newly reaches 100%.
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (!done || isStatic) {
      setCelebrate(false);
      return;
    }
    setCelebrate(true);
    const timer = window.setTimeout(() => setCelebrate(false), 1800);
    return () => window.clearTimeout(timer);
  }, [done, isStatic]);

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className={cn(
          "sticky top-0 z-30 mb-6 w-full rounded-lg border border-border/70 bg-background/95 p-3 shadow-sm backdrop-blur md:static md:z-auto md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none",
          className
        )}
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-xs font-semibold text-foreground">{title}</span>
          <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-foreground tabular-nums">
            <span aria-hidden="true" className="font-mono tracking-[0.15em] text-muted-foreground">
              {gauge}
            </span>
            <span
              className={cn(
                "rounded-full border border-border px-2 py-0.5",
                done && !isStatic && "animate-attention-glow border-primary/60 text-primary"
              )}
            >
              <span aria-hidden="true" className="mr-1">{level.symbol}</span>
              {level.label}
            </span>
            <span
              key={pct}
              className={cn(
                "inline-block min-w-[3ch] text-right",
                !isStatic && "animate-[pct-pop_0.4s_ease-out]"
              )}
            >
              {pct}%
            </span>
            {isMobile && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => setCollapsed((value) => !value)}
                aria-expanded={!collapsed}
                aria-controls="application-progress-details"
                aria-label={collapsed ? "Expand completion details" : "Collapse completion details"}
              >
                {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>

        <div
          className="relative h-4 w-full overflow-visible rounded-full border-2 border-foreground/70 bg-background"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={`${pct} percent complete — ${level.label}`}
          aria-label={title}
        >
          {/* Kenyan flag track (decorative, dimmed so the fill stays legible) */}
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full opacity-40"
            style={{
              backgroundImage:
                "linear-gradient(180deg, hsl(var(--kenya-black)) 0%, hsl(var(--kenya-black)) 28%, hsl(var(--kenya-white)) 28%, hsl(var(--kenya-white)) 38%, hsl(var(--kenya-red)) 38%, hsl(var(--kenya-red)) 62%, hsl(var(--kenya-white)) 62%, hsl(var(--kenya-white)) 72%, hsl(var(--kenya-green)) 72%, hsl(var(--kenya-green)) 100%)",
            }}
          />
          {/* Fill: Kenya green→red, hatch (non-colour cue) + travelling shimmer */}
          <div
            className={cn("absolute inset-y-0 left-0 overflow-hidden rounded-full", motion)}
            style={{
              width: `${pct}%`,
              backgroundImage:
                "repeating-linear-gradient(45deg, hsl(var(--kenya-white) / 0.35) 0 4px, transparent 4px 9px), linear-gradient(90deg, hsl(var(--kenya-green)) 0%, hsl(var(--kenya-green)) 55%, hsl(var(--kenya-red)) 100%)",
            }}
          >
            {!isStatic && (
              <div
                aria-hidden="true"
                className="animate-meter-shimmer absolute inset-y-0 w-1/2 rounded-full"
                style={{
                  backgroundImage:
                    "linear-gradient(100deg, transparent 0%, hsl(var(--kenya-white) / 0.45) 45%, hsl(var(--kenya-white) / 0.6) 50%, hsl(var(--kenya-white) / 0.45) 55%, transparent 100%)",
                }}
              />
            )}
          </div>
          {/* Bursary-KE logo marker */}
          <div
            className={cn("absolute top-1/2 -translate-x-1/2 -translate-y-1/2", motion)}
            style={{ left: `${Math.min(Math.max(pct, 4), 96)}%` }}
          >
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border-2 border-kenya-green bg-background shadow-kenya",
                !isStatic && "animate-meter-bob",
                done && "border-primary"
              )}
            >
              <img
                src={LOGO_URL}
                alt=""
                aria-hidden="true"
                className="h-6 w-6 rounded-full object-contain"
              />
            </div>
            {!isStatic && (
              <div className="mx-auto mt-0.5 flex h-1.5 w-6 overflow-hidden rounded-full" aria-hidden="true">
                <span className="flex-1 bg-kenya-black" />
                <span className="flex-1 bg-kenya-red" />
                <span className="flex-1 bg-kenya-green" />
              </div>
            )}
          </div>
          {celebrate && <ConfettiBurst />}
        </div>

        {done && isStatic && (
          <p
            data-testid="completion-static-badge"
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary/60 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Application complete — ready to submit
          </p>
        )}

        <div id="application-progress-details" className={cn(isMobile && collapsed && "hidden")}>
          {/* Section chips with contextual tooltips */}
          <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5">
            {result.sections.map((s) => (
              <SectionChip key={s.key} section={s} />
            ))}
          </div>

          {result.nextSection && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Next up: {result.nextSection.label}
            </p>
          )}

          {showChecklist && (
            <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-xs font-semibold text-foreground mb-2">
                What&apos;s left {result.remaining.length > 0 && `(${result.remaining.length})`}
              </p>
              {result.remaining.length === 0 ? (
                <p className="flex items-center gap-2 text-xs text-foreground">
                  <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  Everything is filled in — you can review and submit.
                </p>
              ) : (
                <ul className="space-y-1">
                  {result.remaining.slice(0, 5).map((r, i) => (
                    <li key={`${r.sectionKey}-${i}`} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Circle className="mt-[3px] h-3 w-3 flex-shrink-0" aria-hidden="true" />
                      <span>
                        <span className="font-medium text-foreground">{r.sectionLabel}:</span> {r.item}
                      </span>
                    </li>
                  ))}
                  {result.remaining.length > 5 && (
                    <li className="pl-5 text-xs text-muted-foreground">
                      +{result.remaining.length - 5} more to complete
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

function ConfettiBurst() {
  const colors = ["bg-kenya-green", "bg-kenya-red", "bg-foreground", "bg-accent"];
  return (
    <div
      data-testid="completion-confetti"
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-0 z-10 h-0 w-0"
    >
      {Array.from({ length: 18 }, (_, index) => {
        const direction = index % 2 === 0 ? 1 : -1;
        const spread = 26 + (index % 6) * 12;
        const style = {
          "--confetti-x": `${direction * spread}px`,
          "--confetti-r": `${direction * (180 + index * 35)}deg`,
          animationDelay: `${(index % 6) * 45}ms`,
        } as CSSProperties;
        return <span key={index} className={cn("animate-confetti-fall absolute left-0 top-0 h-2.5 w-1.5 rounded-sm", colors[index % colors.length])} style={style} />;
      })}
    </div>
  );
}

function SectionChip({ section }: { section: CompletionSection }) {
  const done = section.ratio >= 1;
  const pct = Math.round(section.ratio * 100);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
            done
              ? "border-primary/50 text-primary font-medium"
              : "border-border text-muted-foreground"
          )}
        >
          <span aria-hidden="true">{done ? "✓" : "•"}</span>
          {section.label} {pct}%
          <Info className="h-3 w-3 opacity-60" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">
        <p className="font-semibold mb-1">
          {section.label} — worth {section.weight}% of the meter
        </p>
        <p>{section.hint}</p>
        {section.missing.length > 0 && (
          <p className="mt-1">
            Still needed: {section.missing.slice(0, 3).join(", ")}
            {section.missing.length > 3 ? "…" : ""}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
