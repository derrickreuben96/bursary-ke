import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, Users, Award, Sparkles } from "lucide-react";
import { platformStats } from "@/lib/mockData";
import { formatKES, formatNumber, formatPercentage } from "@/lib/formatters";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  formatter: (val: number) => string;
  suffix?: string;
  subtext: string;
  delay: number;
  color: string;
}

function AnimatedCounter({ 
  target, 
  formatter, 
  suffix = "",
  duration = 2000 
}: { 
  target: number; 
  formatter: (val: number) => string; 
  suffix?: string;
  duration?: number;
}) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          let startTime: number;
          const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(easeOut * target));
            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration, hasAnimated]);

  return <span ref={ref}>{formatter(count)}{suffix}</span>;
}

function StatCard({ icon, label, value, formatter, suffix, subtext, delay, color }: StatCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <Card
      className={`p-6 shadow-card transition-all duration-500 cursor-pointer group ${
        isVisible ? "animate-slide-up opacity-100" : "opacity-0"
      } ${isHovered ? "shadow-kenya -translate-y-3 scale-105" : "hover:shadow-kenya hover:-translate-y-1"}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${color} transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl md:text-3xl font-bold text-foreground">
            <AnimatedCounter target={value} formatter={formatter} suffix={suffix} />
          </p>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
            <Sparkles className={`h-3 w-3 transition-opacity duration-300 ${isHovered ? "opacity-100 text-primary" : "opacity-0"}`} />
            {subtext}
          </p>
        </div>
      </div>
      
      {/* Progress bar animation on hover */}
      <div className="mt-4 h-1 bg-secondary rounded-full overflow-hidden">
        <div 
          className={`h-full bg-gradient-kenya transition-all duration-700 ${isHovered ? "w-full" : "w-0"}`}
        />
      </div>
    </Card>
  );
}

export function StatsSection() {
  return (
    <section className="py-16 bg-secondary/30">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-3">Making a Difference</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Real impact numbers from our bursary program across Kenya
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            icon={<TrendingUp className="h-6 w-6 text-white" />}
            label="Total Amount Distributed"
            value={platformStats.totalDistributed}
            formatter={(val) => `KES ${(val / 1000000).toFixed(1)}M`}
            subtext="Since program inception"
            delay={0}
            color="bg-primary"
          />
          <StatCard
            icon={<Users className="h-6 w-6 text-white" />}
            label="Students Supported"
            value={platformStats.totalBeneficiaries}
            formatter={formatNumber}
            suffix="+"
            subtext="Across all 47 counties"
            delay={150}
            color="bg-accent"
          />
          <StatCard
            icon={<Award className="h-6 w-6 text-foreground" />}
            label="Success Rate"
            value={platformStats.successRate * 100}
            formatter={(val) => val.toFixed(0)}
            suffix="%"
            subtext="Beneficiary satisfaction"
            delay={300}
            color="bg-yellow-400"
          />
        </div>
      </div>
    </section>
  );
}
