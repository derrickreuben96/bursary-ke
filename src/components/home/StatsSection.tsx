import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, Users, Award } from "lucide-react";
import { platformStats } from "@/lib/mockData";
import { formatKES, formatNumber, formatPercentage } from "@/lib/formatters";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
  delay: number;
}

function StatCard({ icon, label, value, subtext, delay }: StatCardProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <Card
      className={`p-6 shadow-card hover:shadow-kenya transition-all duration-300 hover:-translate-y-1 ${
        isVisible ? "animate-slide-up opacity-100" : "opacity-0"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl md:text-3xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground mt-1">{subtext}</p>
        </div>
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
            icon={<TrendingUp className="h-6 w-6" />}
            label="Total Amount Distributed"
            value={formatKES(platformStats.totalDistributed)}
            subtext="Since program inception"
            delay={0}
          />
          <StatCard
            icon={<Users className="h-6 w-6" />}
            label="Students Supported"
            value={formatNumber(platformStats.totalBeneficiaries) + "+"}
            subtext="Across all 47 counties"
            delay={150}
          />
          <StatCard
            icon={<Award className="h-6 w-6" />}
            label="Success Rate"
            value={formatPercentage(platformStats.successRate)}
            subtext="Beneficiary satisfaction"
            delay={300}
          />
        </div>
      </div>
    </section>
  );
}
