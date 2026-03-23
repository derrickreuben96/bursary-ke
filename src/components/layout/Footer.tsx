import { Link } from "react-router-dom";
import { GraduationCap, Mail, Phone, MapPin, Facebook, Twitter } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-foreground text-background">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <GraduationCap className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">Bursary-KE</span>
            </Link>
            <p className="text-sm text-background/70">
              Empowering Kenyan students through transparent, accessible, and fair bursary distribution.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm text-background/70">
              <li>
                <Link to="/" className="hover:text-background transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/apply/secondary" className="hover:text-background transition-colors">
                  Apply (Secondary)
                </Link>
              </li>
              <li>
                <Link to="/apply/university" className="hover:text-background transition-colors">
                  Apply (University)
                </Link>
              </li>
              <li>
                <Link to="/track" className="hover:text-background transition-colors">
                  Track Application
                </Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-background transition-colors">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold mb-4">Contact Us</h3>
            <ul className="space-y-3 text-sm text-background/70">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>+254 700 123 456</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>support@bursary-ke.go.ke</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5" />
                <span>
                  Ministry of Education Building,
                  <br />
                  Jogoo House, Nairobi
                </span>
              </li>
            </ul>
          </div>

          {/* Legal & Social */}
          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm text-background/70 mb-6">
              <li>
                <a href="https://www.odpc.go.ke/dpa-act/" target="_blank" rel="noopener noreferrer" className="hover:text-background transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="http://kenyalaw.org/kl/fileadmin/pdfdownloads/Acts/ComputerMisuseandCybercrimesAct_No5of2018.pdf" target="_blank" rel="noopener noreferrer" className="hover:text-background transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="https://www.odpc.go.ke/dpa-act/" target="_blank" rel="noopener noreferrer" className="hover:text-background transition-colors">
                  Data Protection
                </a>
              </li>
            </ul>

            <h3 className="font-semibold mb-3">Follow Us</h3>
            <div className="flex gap-3">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-background/10 hover:bg-background/20 transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-background/10 hover:bg-background/20 transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        {/* Compliance Disclaimer */}
        <div className="mt-10 p-4 rounded-lg bg-background/5 border border-background/10 text-xs text-background/60 leading-relaxed">
          <p>
            This platform complies with the{" "}
            <a href="https://www.odpc.go.ke/dpa-act/" target="_blank" rel="noopener noreferrer" className="underline hover:text-background transition-colors">
              Kenya Data Protection Act, 2019
            </a>
            . All personal data collected is processed lawfully, used solely for bursary administration, and protected in accordance with the principles set out by the{" "}
            <a href="https://www.odpc.go.ke" target="_blank" rel="noopener noreferrer" className="underline hover:text-background transition-colors">
              Office of the Data Protection Commissioner (ODPC)
            </a>
            . By using this platform, you consent to the collection and processing of your data for the purposes stated herein.
          </p>
        </div>

        {/* Bottom Bar */}
        <div className="mt-6 pt-6 border-t border-background/10 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-background/60">
          <p>© {currentYear} Bursary-KE. All rights reserved.</p>
          <p>A Government of Kenya Initiative</p>
        </div>
      </div>
    </footer>
  );
}
