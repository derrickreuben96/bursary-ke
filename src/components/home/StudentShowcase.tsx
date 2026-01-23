import { useState, useEffect } from "react";
import africanStudents1 from "@/assets/african-students-1.jpg";
import africanStudents2 from "@/assets/african-students-2.jpg";
import africanStudents3 from "@/assets/african-students-3.jpg";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Users, Building2, Heart } from "lucide-react";

const studentImages = [
  {
    src: africanStudents1,
    alt: "African children learning in classroom",
    caption: "Primary & Secondary Education"
  },
  {
    src: africanStudents2,
    alt: "African university students studying",
    caption: "University & College"
  },
  {
    src: africanStudents3,
    alt: "African students in library",
    caption: "Academic Excellence"
  }
];

const impactStats = [
  {
    icon: GraduationCap,
    value: "10,000+",
    label: "Students Supported",
    color: "text-primary"
  },
  {
    icon: Building2,
    value: "47",
    label: "Counties Covered",
    color: "text-green-600"
  },
  {
    icon: Heart,
    value: "KES 500M+",
    label: "Disbursed in 2025",
    color: "text-red-500"
  },
  {
    icon: Users,
    value: "95%",
    label: "Satisfaction Rate",
    color: "text-blue-600"
  }
];

export function StudentShowcase() {
  const [currentImage, setCurrentImage] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentImage((prev) => (prev + 1) % studentImages.length);
        setIsAnimating(false);
      }, 300);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-16 bg-gradient-to-br from-secondary/50 via-background to-primary/5 overflow-hidden">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Image Showcase */}
          <div className="relative">
            {/* Main Image */}
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl">
              <img
                src={studentImages[currentImage].src}
                alt={studentImages[currentImage].alt}
                className={`w-full h-full object-cover transition-all duration-500 ${
                  isAnimating ? "opacity-0 scale-105" : "opacity-100 scale-100"
                }`}
              />
              {/* Caption overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                <p className="text-white font-semibold text-lg">
                  {studentImages[currentImage].caption}
                </p>
              </div>
            </div>

            {/* Thumbnail navigation */}
            <div className="flex gap-3 mt-4 justify-center">
              {studentImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImage(idx)}
                  className={`w-20 h-14 rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                    idx === currentImage
                      ? "border-primary shadow-lg"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <img
                    src={img.src}
                    alt={img.alt}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>

            {/* Decorative elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/20 rounded-full blur-xl" />
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-green-500/20 rounded-full blur-xl" />
          </div>

          {/* Right: Content */}
          <div className="space-y-8">
            <div>
              <span className="text-primary font-semibold text-sm uppercase tracking-wider">
                Empowering Kenya's Future
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-2">
                Every Student Deserves a <span className="text-primary">Chance to Learn</span>
              </h2>
              <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
                The Kenya Bursary Portal connects deserving students with educational 
                funding opportunities. From primary school to university, we ensure 
                that financial barriers don't stop bright minds from achieving their dreams.
              </p>
            </div>

            {/* Impact Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              {impactStats.map((stat, idx) => (
                <Card 
                  key={idx} 
                  className="border-none shadow-md hover:shadow-lg transition-shadow bg-card/80 backdrop-blur hover:scale-105 duration-300"
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-secondary ${stat.color}`}>
                      <stat.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-lg text-foreground">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Quote */}
            <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground">
              "Education is the most powerful weapon which you can use to change the world."
              <footer className="text-sm mt-2 not-italic font-medium text-foreground">
                — Nelson Mandela
              </footer>
            </blockquote>
          </div>
        </div>
      </div>
    </section>
  );
}
