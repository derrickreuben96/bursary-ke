import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminDashboardData } from "@/lib/mockData";
import { formatKES, formatNumber, formatPercentage } from "@/lib/formatters";
import {
  Users,
  CheckCircle,
  Clock,
  XCircle,
  Banknote,
  TrendingUp,
  BarChart3,
  PieChart,
} from "lucide-react";
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";

const COLORS = ["hsl(120, 100%, 20%)", "hsl(45, 100%, 50%)", "hsl(350, 81%, 45%)"];

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
}

function StatCard({ title, value, icon, trend, trendUp }: StatCardProps) {
  return (
    <Card className="hover:shadow-kenya transition-all duration-300 hover:-translate-y-1">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {trend && (
          <p className={`text-xs mt-1 ${trendUp ? "text-primary" : "text-accent"}`}>
            {trendUp ? "↑" : "↓"} {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const {
    totalApplications,
    approvedApplications,
    pendingApplications,
    rejectedApplications,
    totalBudgetDisbursed,
    povertyDistribution,
    applicationsByCounty,
    monthlyTrends,
  } = adminDashboardData;

  const approvalRate = (approvedApplications / totalApplications) * 100;

  return (
    <div className="min-h-screen flex flex-col bg-secondary/30">
      <Header />
      <main className="flex-1 container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Overview of bursary applications and fund distribution (aggregated data only - no PII visible)
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard
            title="Total Applications"
            value={formatNumber(totalApplications)}
            icon={<Users className="h-5 w-5" />}
            trend="+12% this month"
            trendUp={true}
          />
          <StatCard
            title="Approved"
            value={formatNumber(approvedApplications)}
            icon={<CheckCircle className="h-5 w-5" />}
            trend={formatPercentage(approvalRate / 100) + " rate"}
            trendUp={true}
          />
          <StatCard
            title="Pending Review"
            value={formatNumber(pendingApplications)}
            icon={<Clock className="h-5 w-5" />}
          />
          <StatCard
            title="Rejected"
            value={formatNumber(rejectedApplications)}
            icon={<XCircle className="h-5 w-5" />}
          />
          <StatCard
            title="Total Disbursed"
            value={formatKES(totalBudgetDisbursed)}
            icon={<Banknote className="h-5 w-5" />}
            trend="+8% vs last quarter"
            trendUp={true}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Poverty Distribution Pie Chart */}
          <Card className="hover:shadow-kenya transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <PieChart className="h-5 w-5 text-primary" />
                Poverty Tier Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={povertyDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="tier"
                      label={({ tier, percentage }) => `${tier}: ${percentage}%`}
                    >
                      {povertyDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [formatNumber(value), "Applications"]}
                    />
                    <Legend />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Applications by County Bar Chart */}
          <Card className="hover:shadow-kenya transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-primary" />
                Applications by County
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={applicationsByCounty} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="county" type="category" width={80} />
                    <Tooltip
                      formatter={(value: number) => [formatNumber(value), "Applications"]}
                    />
                    <Bar
                      dataKey="count"
                      fill="hsl(120, 100%, 20%)"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Trends Line Chart */}
        <Card className="hover:shadow-kenya transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              Monthly Application Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => [formatNumber(value), "Applications"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="applications"
                    stroke="hsl(120, 100%, 20%)"
                    strokeWidth={3}
                    dot={{ fill: "hsl(120, 100%, 20%)", strokeWidth: 2 }}
                    activeDot={{ r: 8, fill: "hsl(350, 81%, 45%)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Notice */}
        <div className="mt-8 p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <p className="text-sm text-muted-foreground text-center">
            <strong className="text-foreground">Privacy Compliant Dashboard:</strong> This dashboard displays only aggregated statistics. 
            No personally identifiable information (PII) such as names, ID numbers, or contact details is visible or accessible.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
