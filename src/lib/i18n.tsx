import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

type Language = "en" | "sw";

const translations: Record<string, Record<Language, string>> = {
  // Header / Nav
  "nav.home": { en: "Home", sw: "Nyumbani" },
  "nav.browse": { en: "Browse Bursaries", sw: "Tazama Bursari" },
  "nav.apply_secondary": { en: "Apply (Secondary)", sw: "Omba (Sekondari)" },
  "nav.apply_university": { en: "Apply (University)", sw: "Omba (Chuo Kikuu)" },
  "nav.track": { en: "Track Application", sw: "Fuatilia Maombi" },
  "nav.faq": { en: "FAQ", sw: "Maswali" },
  "nav.portals": { en: "Portals", sw: "Milango" },
  "nav.portal": { en: "Portal", sw: "Mlango" },
  "header.tagline": { en: "Empowering Education", sw: "Kuwezesha Elimu" },

  // Hero
  "hero.badge": { en: "Government of Kenya Initiative", sw: "Mpango wa Serikali ya Kenya" },
  "hero.title_1": { en: "Empowering Kenyan Students Through", sw: "Kuwawezesha Wanafunzi wa Kenya Kupitia" },
  "hero.title_2": { en: "Transparent Bursaries", sw: "Bursari za Uwazi" },
  "hero.subtitle": {
    en: "Access educational funding through a fair, transparent, and secure platform. Apply for bursaries for secondary school, university, or college education.",
    sw: "Pata ufadhili wa elimu kupitia jukwaa la haki, uwazi, na salama. Omba bursari za shule za upili, chuo kikuu, au elimu ya chuo.",
  },
  "hero.apply_now": { en: "Apply Now", sw: "Omba Sasa" },
  "hero.track": { en: "Track Application", sw: "Fuatilia Maombi" },
  "hero.free": { en: "100% Free Application", sw: "Maombi ya Bure 100%" },
  "hero.secure": { en: "Secure & Private", sw: "Salama na Faragha" },
  "hero.realtime": { en: "Real-time Tracking", sw: "Ufuatiliaji wa Wakati Halisi" },
  "hero.live_programs": { en: "Open Bursary Programs Across Kenya", sw: "Programu za Bursari Zilizo Wazi Kenya" },
  "hero.county": { en: "County", sw: "Kaunti" },
  "hero.left": { en: "left", sw: "zimebaki" },

  // Stats
  "stats.title": { en: "Making a Difference", sw: "Kuleta Mabadiliko" },
  "stats.subtitle": { en: "Real impact numbers from our bursary program across Kenya", sw: "Takwimu halisi za athari za programu yetu ya bursari kote Kenya" },
  "stats.total_distributed": { en: "Total Amount Distributed", sw: "Jumla ya Fedha Zilizotolewa" },
  "stats.since_inception": { en: "Since program inception", sw: "Tangu programu kuanza" },
  "stats.students_supported": { en: "Students Supported", sw: "Wanafunzi Walioungwa Mkono" },
  "stats.across_counties": { en: "Across all 47 counties", sw: "Katika kaunti zote 47" },
  "stats.success_rate": { en: "Success Rate", sw: "Kiwango cha Mafanikio" },
  "stats.satisfaction": { en: "Beneficiary satisfaction", sw: "Kuridhika kwa wanufaika" },

  // Reviews
  "reviews.title": { en: "What Beneficiaries Say", sw: "Wanufaika Wanasema Nini" },
  "reviews.subtitle": { en: "Real stories from students and parents who have benefited from Bursary-KE", sw: "Hadithi halisi kutoka kwa wanafunzi na wazazi walionufaika na Bursary-KE" },

  // Tracking Widget
  "tracking.title": { en: "Track Your Application", sw: "Fuatilia Maombi Yako" },
  "tracking.subtitle": { en: "Enter your tracking number to check your application status", sw: "Ingiza nambari yako ya ufuatiliaji kuangalia hali ya maombi yako" },
  "tracking.placeholder": { en: "Enter tracking number (e.g., BKE-ABC123)", sw: "Ingiza nambari ya ufuatiliaji (mfano, BKE-ABC123)" },
  "tracking.button": { en: "Track", sw: "Fuatilia" },
  "tracking.error_empty": { en: "Please enter a tracking number", sw: "Tafadhali ingiza nambari ya ufuatiliaji" },
  "tracking.error_format": { en: "Invalid format. Use BKE-XXXXXX (e.g., BKE-ABC123)", sw: "Muundo batili. Tumia BKE-XXXXXX (mfano, BKE-ABC123)" },
  "tracking.found": { en: "Application Found", sw: "Maombi Yamepatikana" },
  "tracking.current_stage": { en: "Current Stage", sw: "Hatua ya Sasa" },
  "tracking.view_details": { en: "View full details →", sw: "Tazama maelezo kamili →" },
  "tracking.not_found": { en: "Application Not Found", sw: "Maombi Hayajapatikana" },
  "tracking.not_found_hint": { en: "Please check your tracking number and try again", sw: "Tafadhali kagua nambari yako ya ufuatiliaji na ujaribu tena" },
  "tracking.lost_number": { en: "Lost your tracking number?", sw: "Umepoteza nambari yako ya ufuatiliaji?" },
  "tracking.contact_support": { en: "Contact support", sw: "Wasiliana na msaada" },

  // Bursary Slider
  "bursary.programs_badge": { en: "Bursary Programs", sw: "Programu za Bursari" },
  "bursary.open_apps": { en: "Open Applications", sw: "Maombi Yaliyo Wazi" },
  "bursary.county_programs": { en: "County Bursary Programs", sw: "Programu za Bursari za Kaunti" },
  "bursary.no_active": { en: "No active bursary programs at the moment. Subscribe to get notified when new opportunities open.", sw: "Hakuna programu za bursari zinazoendelea kwa sasa. Jiandikishe kupata arifa programu mpya zinapofunguka." },
  "bursary.dont_miss": { en: "Don't miss out! Apply now for active bursary opportunities in your county.", sw: "Usikose! Omba sasa kwa fursa za bursari zinazoendelea katika kaunti yako." },
  "bursary.stay_informed": { en: "Stay Informed", sw: "Baki na Taarifa" },
  "bursary.subscribe_desc": { en: "Subscribe to receive instant notifications when new bursary opportunities become available in your county.", sw: "Jiandikishe kupokea arifa za papo hapo programu mpya za bursari zinapopatikana katika kaunti yako." },
  "bursary.view_past": { en: "View Past Bursaries", sw: "Tazama Bursari Zilizopita" },
  "bursary.quick_search": { en: "Quick Search:", sw: "Tafuta Haraka:" },
  "bursary.select_county": { en: "Select County", sw: "Chagua Kaunti" },
  "bursary.select_ward": { en: "Select Ward", sw: "Chagua Wadi" },
  "bursary.clear": { en: "Clear", sw: "Futa" },
  "bursary.clear_filters": { en: "Clear Filters", sw: "Futa Vichujio" },
  "bursary.no_results": { en: "No bursaries found for this selection.", sw: "Hakuna bursari zilizopatikana kwa chaguo hili." },
  "bursary.showing": { en: "Showing", sw: "Inaonyesha" },
  "bursary.results": { en: "results", sw: "matokeo" },
  "bursary.result": { en: "result", sw: "tokeo" },
  "bursary.in": { en: "in", sw: "katika" },
  "bursary.budget": { en: "Budget", sw: "Bajeti" },
  "bursary.apply_now": { en: "Apply Now", sw: "Omba Sasa" },
  "bursary.view_all": { en: "View All", sw: "Tazama Zote" },
  "bursary.required_docs": { en: "Required Documents", sw: "Nyaraka Zinazohitajika" },
  "bursary.more_docs": { en: "more documents...", sw: "nyaraka zaidi..." },
  "bursary.assistance_centers": { en: "Assistance Centers", sw: "Vituo vya Msaada" },
  "bursary.want_alerts": { en: "Want alerts for", sw: "Unataka arifa za" },

  // Countdown Timer
  "timer.time_remaining": { en: "Time Remaining", sw: "Muda Uliobaki" },
  "timer.deadline_approaching": { en: "⏰ Deadline Approaching!", sw: "⏰ Muda Unakaribia!" },
  "timer.closed": { en: "Application Closed", sw: "Maombi Yamefungwa" },
  "timer.days": { en: "Days", sw: "Siku" },
  "timer.hours": { en: "Hours", sw: "Masaa" },
  "timer.mins": { en: "Mins", sw: "Dakika" },
  "timer.secs": { en: "Secs", sw: "Sekunde" },

  // Subscribe / Notifications
  "subscribe.button": { en: "Subscribe for Alerts", sw: "Jiandikishe kwa Arifa" },
  "subscribe.get_notified": { en: "Get notified", sw: "Pata arifa" },
  "subscribe.dialog_title": { en: "Subscribe for Bursary Alerts", sw: "Jiandikishe kwa Arifa za Bursari" },
  "subscribe.dialog_desc": { en: "Get notified via SMS or email when new bursary opportunities open in your county.", sw: "Pata arifa kupitia SMS au barua pepe fursa mpya za bursari zinapofunguka katika kaunti yako." },
  "subscribe.select_county": { en: "Select Your County *", sw: "Chagua Kaunti Yako *" },
  "subscribe.choose_county": { en: "Choose county...", sw: "Chagua kaunti..." },
  "subscribe.phone_label": { en: "Phone Number (SMS alerts)", sw: "Nambari ya Simu (arifa za SMS)" },
  "subscribe.email_label": { en: "Email Address", sw: "Anwani ya Barua Pepe" },
  "subscribe.contact_required": { en: "* At least one contact method (phone or email) is required.", sw: "* Angalau njia moja ya mawasiliano (simu au barua pepe) inahitajika." },
  "subscribe.subscribing": { en: "Subscribing...", sw: "Inajiandikisha..." },
  "subscribe.success": { en: "You're now subscribed! We'll notify you when new bursaries open in", sw: "Umejiandikisha! Tutakuarifu bursari mpya zinapofunguka katika" },

  // Bursary Ticker
  "ticker.heading": { en: "Open Bursary Applications Across Kenya", sw: "Maombi ya Bursari Yaliyo Wazi Kenya" },
  "ticker.counties_accepting": { en: "counties accepting applications", sw: "kaunti zinazopokea maombi" },

  // FAQ Page
  "faq.title": { en: "Frequently Asked Questions", sw: "Maswali Yanayoulizwa Mara kwa Mara" },
  "faq.subtitle": { en: "Find answers to common questions about the bursary application process", sw: "Pata majibu ya maswali ya kawaida kuhusu mchakato wa maombi ya bursari" },
  "faq.view_all": { en: "View All FAQs", sw: "Tazama Maswali Yote" },
  "faq.page_subtitle": { en: "Find answers to common questions about the Bursary-KE application process, eligibility, and fund distribution.", sw: "Pata majibu ya maswali ya kawaida kuhusu mchakato wa maombi ya Bursary-KE, vigezo, na usambazaji wa fedha." },
  "faq.search_placeholder": { en: "Search questions...", sw: "Tafuta maswali..." },
  "faq.found": { en: "Found", sw: "Imepatikana" },
  "faq.results_for": { en: "for", sw: "kwa" },
  "faq.no_results": { en: "No results found", sw: "Hakuna matokeo yaliyopatikana" },
  "faq.no_results_hint": { en: "Try adjusting your search terms or browse all questions below.", sw: "Jaribu kubadilisha maneno ya utafutaji au tazama maswali yote hapa chini." },
  "faq.clear_search": { en: "Clear Search", sw: "Futa Utafutaji" },
  "faq.still_questions": { en: "Still Have Questions?", sw: "Bado Una Maswali?" },
  "faq.still_questions_desc": { en: "Can't find what you're looking for? Our support team is here to help.", sw: "Hupati unachotafuta? Timu yetu ya msaada ipo hapa kukusaidia." },
  "faq.ai_assistant": { en: "AI Assistant", sw: "Msaidizi wa AI" },
  "faq.ai_instant": { en: "Get instant answers powered by AI", sw: "Pata majibu ya papo hapo kupitia AI" },
  "faq.ask_ai": { en: "Ask AI", sw: "Uliza AI" },
  "faq.call_us": { en: "Call Us", sw: "Tupigie" },
  "faq.call_hours": { en: "Mon-Fri 8:00 AM - 5:00 PM EAT", sw: "Jumatatu-Ijumaa 8:00 asubuhi - 5:00 jioni EAT" },
  "faq.email_us": { en: "Email Us", sw: "Tutumie Barua Pepe" },
  "faq.email_response": { en: "We'll respond within 24 hours", sw: "Tutajibu ndani ya masaa 24" },
  "faq.ready_apply": { en: "Ready to Apply?", sw: "Uko Tayari Kuomba?" },
  "faq.ready_apply_desc": { en: "Start your bursary application today and take the first step towards achieving your educational goals.", sw: "Anza maombi yako ya bursari leo na uchukue hatua ya kwanza kuelekea kufikia malengo yako ya kielimu." },
  "faq.apply_secondary": { en: "Apply for Secondary", sw: "Omba kwa Sekondari" },
  "faq.apply_university": { en: "Apply for University", sw: "Omba kwa Chuo Kikuu" },

  // Track Page
  "track.page_title": { en: "Track Your Application", sw: "Fuatilia Maombi Yako" },
  "track.page_subtitle": { en: "Enter your tracking number and verification details to see your bursary application status", sw: "Ingiza nambari yako ya ufuatiliaji na maelezo ya uthibitisho kuona hali ya maombi yako ya bursari" },
  "track.tracking_number": { en: "Tracking Number", sw: "Nambari ya Ufuatiliaji" },
  "track.verification_required": { en: "Verification Required", sw: "Uthibitisho Unahitajika" },
  "track.verification_desc": { en: "For security, please verify your identity using the phone number or national ID used during application.", sw: "Kwa usalama, tafadhali thibitisha utambulisho wako kwa kutumia nambari ya simu au kitambulisho cha taifa ulichotumia wakati wa maombi." },
  "track.phone_number": { en: "Phone Number", sw: "Nambari ya Simu" },
  "track.national_id": { en: "National ID", sw: "Kitambulisho cha Taifa" },
  "track.enter_phone": { en: "Enter phone (e.g., 0712345678)", sw: "Ingiza simu (mfano, 0712345678)" },
  "track.enter_national_id": { en: "Enter National ID", sw: "Ingiza Kitambulisho cha Taifa" },
  "track.track_button": { en: "Track Application", sw: "Fuatilia Maombi" },
  "track.error_enter_tracking": { en: "Please enter a tracking number", sw: "Tafadhali ingiza nambari ya ufuatiliaji" },
  "track.error_invalid_format": { en: "Invalid format. Use BKE-XXXXXX (e.g., BKE-ABC123)", sw: "Muundo batili. Tumia BKE-XXXXXX (mfano, BKE-ABC123)" },
  "track.error_enter_verification": { en: "for verification", sw: "kwa uthibitisho" },
  "track.not_found_title": { en: "Application Not Found", sw: "Maombi Hayajapatikana" },
  "track.not_found_desc": { en: "We couldn't find an application matching your tracking number and verification details.", sw: "Hatukuweza kupata maombi yanayolingana na nambari yako ya ufuatiliaji na maelezo ya uthibitisho." },
  "track.not_found_hint": { en: "Please verify your tracking number and ensure you're using the same phone number or national ID that was provided during application. If you believe this is an error,", sw: "Tafadhali thibitisha nambari yako ya ufuatiliaji na uhakikishe unatumia nambari ya simu au kitambulisho cha taifa kilichotolewa wakati wa maombi. Ikiwa unaamini hii ni kosa," },
  "track.contact_support": { en: "contact support", sw: "wasiliana na msaada" },
  "track.application_details": { en: "Application Details", sw: "Maelezo ya Maombi" },
  "track.application_type": { en: "Application Type", sw: "Aina ya Maombi" },
  "track.current_stage": { en: "Current Stage", sw: "Hatua ya Sasa" },
  "track.secondary_student": { en: "Secondary Student", sw: "Mwanafunzi wa Sekondari" },
  "track.university_student": { en: "University Student", sw: "Mwanafunzi wa Chuo Kikuu" },
  "track.progress": { en: "Application Progress", sw: "Maendeleo ya Maombi" },
  "track.need_help": { en: "Need help with your application?", sw: "Unahitaji msaada na maombi yako?" },
  "track.visit_faq": { en: "Visit our FAQ", sw: "Tembelea Maswali Yetu" },
  "track.or_contact": { en: "or contact support at", sw: "au wasiliana na msaada kwa" },
  "track.demo_title": { en: "Demo Tracking Numbers", sw: "Nambari za Ufuatiliaji za Maonyesho" },
  "track.demo_desc": { en: "Try these sample tracking numbers to see the tracking system in action:", sw: "Jaribu nambari hizi za ufuatiliaji kuona mfumo wa ufuatiliaji unavyofanya kazi:" },

  // Application Forms
  "apply.secondary_title": { en: "Secondary School Bursary Application", sw: "Maombi ya Bursari ya Shule ya Sekondari" },
  "apply.university_title": { en: "University/College Bursary Application", sw: "Maombi ya Bursari ya Chuo Kikuu" },
  "apply.university_subtitle": { en: "Apply for financial assistance for your higher education", sw: "Omba msaada wa kifedha kwa elimu yako ya juu" },
  "apply.applying_to": { en: "Applying to:", sw: "Unaomba kwa:" },
  "apply.secure_form": { en: "Secure Form", sw: "Fomu Salama" },
  "apply.data_encrypted": { en: "Data Encrypted", sw: "Data Imesimbwa" },
  "apply.form_desc": { en: "Complete the form below to apply for educational funding. Your information is encrypted and protected.", sw: "Jaza fomu hapa chini kuomba ufadhili wa elimu. Taarifa zako zimesimbwa na kulindwa." },
  "apply.need_help": { en: "Need help?", sw: "Unahitaji msaada?" },
  "apply.view_faq": { en: "View FAQ", sw: "Tazama Maswali" },
  "apply.or_contact": { en: "or contact", sw: "au wasiliana" },
  "apply.back": { en: "Back", sw: "Rudi" },
  "apply.continue_review": { en: "Continue to Review", sw: "Endelea Kukagua" },

  // Steps
  "step.parent_info": { en: "Parent Info", sw: "Taarifa za Mzazi" },
  "step.student_info": { en: "Student Info", sw: "Taarifa za Mwanafunzi" },
  "step.assessment": { en: "Assessment", sw: "Tathmini" },
  "step.documents": { en: "Documents", sw: "Nyaraka" },
  "step.review": { en: "Review", sw: "Kagua" },
  "step.parent_guardian": { en: "Parent/Guardian", sw: "Mzazi/Mlezi" },

  // Footer
  "footer.tagline": { en: "Empowering Kenyan students through transparent, accessible, and fair bursary distribution.", sw: "Kuwawezesha wanafunzi wa Kenya kupitia usambazaji wa bursari wenye uwazi, upatikanaji, na haki." },
  "footer.quick_links": { en: "Quick Links", sw: "Viungo vya Haraka" },
  "footer.contact_us": { en: "Contact Us", sw: "Wasiliana Nasi" },
  "footer.legal": { en: "Legal", sw: "Kisheria" },
  "footer.privacy": { en: "Privacy Policy", sw: "Sera ya Faragha" },
  "footer.terms": { en: "Terms of Service", sw: "Masharti ya Huduma" },
  "footer.data_protection": { en: "Data Protection", sw: "Ulinzi wa Data" },
  "footer.follow_us": { en: "Follow Us", sw: "Tufuate" },
  "footer.rights": { en: "All rights reserved.", sw: "Haki zote zimehifadhiwa." },
  "footer.gov_initiative": { en: "A Government of Kenya Initiative", sw: "Mpango wa Serikali ya Kenya" },
  "footer.compliance": {
    en: "This platform complies with the Kenya Data Protection Act, 2019. All personal data collected is processed lawfully, used solely for bursary administration, and protected in accordance with the principles set out by the Office of the Data Protection Commissioner (ODPC). By using this platform, you consent to the collection and processing of your data for the purposes stated herein.",
    sw: "Jukwaa hili linazingatia Sheria ya Ulinzi wa Data ya Kenya, 2019. Data zote za kibinafsi zinazokusanywa zinashughulikiwa kisheria, zinatumika tu kwa usimamizi wa bursari, na zinalindwa kulingana na kanuni zilizowekwa na Ofisi ya Kamishna wa Ulinzi wa Data (ODPC). Kwa kutumia jukwaa hili, unakubali ukusanyaji na usindikaji wa data yako kwa madhumuni yaliyoelezwa hapa.",
  },

  // Form fields (kept from before)
  "form.parent_title": { en: "Parent/Guardian Information", sw: "Taarifa za Mzazi/Mlezi" },
  "form.student_title": { en: "Student Information", sw: "Taarifa za Mwanafunzi" },
  "form.assessment": { en: "Poverty Assessment", sw: "Tathmini ya Umaskini" },
  "form.review": { en: "Review & Submit", sw: "Kagua na Wasilisha" },
  "form.next": { en: "Next", sw: "Endelea" },
  "form.back": { en: "Back", sw: "Rudi" },
  "form.submit": { en: "Submit Application", sw: "Wasilisha Maombi" },

  // Document Upload
  "docs.upload_title": { en: "Upload Required Documents", sw: "Pakia Nyaraka Zinazohitajika" },
  "docs.upload_desc": { en: "Upload clear scans or photos of required documents", sw: "Pakia picha au skani za nyaraka zinazohitajika" },
  "docs.national_id": { en: "National ID (Parent/Guardian)", sw: "Kitambulisho cha Taifa (Mzazi/Mlezi)" },
  "docs.birth_cert": { en: "Birth Certificate", sw: "Cheti cha Kuzaliwa" },
  "docs.admission_letter": { en: "School Admission Letter", sw: "Barua ya Kuandikishwa Shuleni" },
  "docs.fee_structure": { en: "Fee Structure", sw: "Muundo wa Ada" },
  "docs.transcripts": { en: "Academic Transcripts", sw: "Nakala za Kielimu" },
  "docs.max_size": { en: "Max 5MB per file. PDF, JPG, PNG accepted.", sw: "Upeo wa 5MB kwa faili. PDF, JPG, PNG zinakubalika." },

  // Hero Ticker
  "hero.county_label": { en: "County", sw: "Kaunti" },
  "hero.days_hours_left": { en: "left", sw: "zimebaki" },

  // BursaryAdverts component
  "adverts.open_apps": { en: "Open Applications", sw: "Maombi Yaliyo Wazi" },
  "adverts.county_programs": { en: "County Bursary Programs", sw: "Programu za Bursari za Kaunti" },
  "adverts.browse_desc": { en: "Browse active bursary opportunities in your county. Apply online or visit our assistance centers.", sw: "Tazama fursa za bursari zinazoendelea katika kaunti yako. Omba mtandaoni au tembelea vituo vyetu vya msaada." },
  "adverts.deadline": { en: "Application Deadline", sw: "Mwisho wa Maombi" },
  "adverts.days_left": { en: "days left!", sw: "siku zimebaki!" },
  "adverts.budget_label": { en: "Budget:", sw: "Bajeti:" },
  "currency.kes": { en: "KES", sw: "Shilingi" },
  "adverts.physical_centers": { en: "Physical Assistance Centers:", sw: "Vituo vya Msaada wa Ana kwa Ana:" },
  "adverts.docs_required": { en: "Documents Required (In-Person):", sw: "Nyaraka Zinazohitajika (Ana kwa Ana):" },
  "adverts.more": { en: "more...", sw: "zaidi..." },
  "adverts.apply_now": { en: "Apply Now", sw: "Omba Sasa" },
  "adverts.showing_count": { en: "active bursary programs. More counties coming soon.", sw: "programu za bursari zinazoendelea. Kaunti zaidi zinakuja hivi karibuni." },

  // Bursaries page
  "bursaries.title": { en: "Available Bursaries", sw: "Bursari Zinazopatikana" },
  "bursaries.subtitle": { en: "Browse and apply for county bursary programs", sw: "Tazama na uombe programu za bursari za kaunti" },
  "bursaries.filters": { en: "Filters:", sw: "Vichujio:" },
  "bursaries.search_placeholder": { en: "Search by title or description...", sw: "Tafuta kwa kichwa au maelezo..." },
  "bursaries.all_counties": { en: "All Counties", sw: "Kaunti Zote" },
  "bursaries.all_wards": { en: "All Wards", sw: "Wadi Zote" },
  "bursaries.all_deadlines": { en: "All Deadlines", sw: "Tarehe Zote za Mwisho" },
  "bursaries.within_days": { en: "Within", sw: "Ndani ya" },
  "bursaries.days": { en: "days", sw: "siku" },
  "bursaries.within_months": { en: "Within 3 months", sw: "Ndani ya miezi 3" },
  "bursaries.clear": { en: "Clear", sw: "Futa" },
  "bursaries.clear_filters": { en: "Clear Filters", sw: "Futa Vichujio" },
  "bursaries.programs_found": { en: "bursary program", sw: "programu ya bursari" },
  "bursaries.programs_found_plural": { en: "bursary programs", sw: "programu za bursari" },
  "bursaries.found": { en: "found", sw: "zimepatikana" },
  "bursaries.no_found": { en: "No bursaries found", sw: "Hakuna bursari zilizopatikana" },
  "bursaries.adjust_filters": { en: "Try adjusting your filters to see more results.", sw: "Jaribu kubadilisha vichujio vyako kuona matokeo zaidi." },
  "bursaries.no_active": { en: "There are no active bursary programs at the moment. Please check back later.", sw: "Hakuna programu za bursari zinazoendelea kwa sasa. Tafadhali rudi baadaye." },
  "bursaries.urgent": { en: "Urgent", sw: "Haraka" },
  "bursaries.days_left": { en: "days left", sw: "siku zimebaki" },
  "bursaries.deadline": { en: "Deadline:", sw: "Mwisho:" },
  "bursaries.budget": { en: "Budget:", sw: "Bajeti:" },
  "bursaries.not_specified": { en: "Not specified", sw: "Haijatajwa" },
  "bursaries.assistance_center": { en: "assistance center", sw: "kituo cha msaada" },
  "bursaries.assistance_centers": { en: "assistance centers", sw: "vituo vya msaada" },
  "bursaries.required_doc": { en: "required document", sw: "nyaraka inayohitajika" },
  "bursaries.required_docs": { en: "required documents", sw: "nyaraka zinazohitajika" },
  "bursaries.apply_now": { en: "Apply Now", sw: "Omba Sasa" },

  // Tracking stages - names
  "stage.received": { en: "Application Received", sw: "Maombi Yamepokelewa" },
  "stage.review": { en: "Under Review", sw: "Inakaguliwa" },
  "stage.verification": { en: "Verification & Screening", sw: "Uthibitishaji na Uchunguzi" },
  "stage.approved": { en: "Approval Decision", sw: "Uamuzi wa Idhini" },
  "stage.rejected": { en: "Application Not Successful", sw: "Maombi Hayakufaulu" },
  "stage.disbursed": { en: "Funds Disbursed", sw: "Fedha Zimetolewa" },

  // Tracking stages - messages
  "stage.msg.received": { en: "Your application has been received and is in our system.", sw: "Maombi yako yamepokelewa na yako katika mfumo wetu." },
  "stage.msg.review": { en: "Your application is being reviewed by our team.", sw: "Maombi yako yanakaguliwa na timu yetu." },
  "stage.msg.verification": { en: "Your application is being verified and screened by the Commissioner.", sw: "Maombi yako yanathibitishwa na kuchunguzwa na Kamishna." },
  "stage.msg.approved": { en: "Your application has been approved for funding.", sw: "Maombi yako yameidhinishwa kwa ufadhili." },
  "stage.msg.approved_amount": { en: "Your application has been approved! Amount:", sw: "Maombi yako yameidhinishwa! Kiasi:" },
  "stage.msg.rejected": { en: "Your application was not successful in this funding cycle. You may apply again in the next cycle.", sw: "Maombi yako hayakufaulu katika mzunguko huu wa ufadhili. Unaweza kuomba tena katika mzunguko ujao." },
  "stage.msg.disbursed": { en: "Funds have been sent to your institution.", sw: "Fedha zimetumwa kwa taasisi yako." },
  "stage.msg.disbursed_to": { en: "Funds have been sent to", sw: "Fedha zimetumwa kwa" },
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem("bursary-lang");
    return (saved === "sw" ? "sw" : "en") as Language;
  });

  const handleSetLanguage = useCallback((lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("bursary-lang", lang);
  }, []);

  const t = useCallback(
    (key: string): string => {
      return translations[key]?.[language] || key;
    },
    [language]
  );

  return (
    <I18nContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

// Common document name translations (database content → Swahili)
const documentTranslations: Record<string, string> = {
  "National ID": "Kitambulisho cha Taifa",
  "National ID (Parent/Guardian)": "Kitambulisho cha Taifa (Mzazi/Mlezi)",
  "Birth Certificate": "Cheti cha Kuzaliwa",
  "School Admission Letter": "Barua ya Kukubaliwa Shuleni",
  "Admission Letter": "Barua ya Kukubaliwa",
  "Fee Structure": "Muundo wa Ada",
  "KCPE Results": "Matokeo ya KCPE",
  "KCSE Results": "Matokeo ya KCSE",
  "KCPE/KCSE Results": "Matokeo ya KCPE/KCSE",
  "Chief's Letter": "Barua ya Chifu",
  "Death Certificate": "Cheti cha Kifo",
  "Medical Report": "Ripoti ya Matibabu",
  "Disability Certificate": "Cheti cha Ulemavu",
  "School ID": "Kitambulisho cha Shule",
  "Student ID": "Kitambulisho cha Mwanafunzi",
  "Transcript": "Nakala ya Matokeo",
  "Report Card": "Kadi ya Ripoti",
  "Passport Photo": "Picha ya Pasipoti",
  "Community Leader Letter": "Barua ya Kiongozi wa Jamii",
  "Proof of Income": "Uthibitisho wa Mapato",
  "Bank Statement": "Taarifa ya Benki",
  "University Admission Letter": "Barua ya Kukubaliwa Chuoni",
  "College Admission Letter": "Barua ya Kukubaliwa Chuoni",
  "HELB Statement": "Taarifa ya HELB",
  "KRA PIN Certificate": "Cheti cha KRA PIN",
  "Orphan Certificate": "Cheti cha Yatima",
};

export function translateDocument(doc: string, language: Language): string {
  if (language === "en") return doc;
  // Try exact match first, then case-insensitive
  if (documentTranslations[doc]) return documentTranslations[doc];
  const lower = doc.toLowerCase();
  for (const [key, val] of Object.entries(documentTranslations)) {
    if (key.toLowerCase() === lower) return val;
  }
  return doc;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}

export function LanguageToggle() {
  const { language, setLanguage } = useI18n();

  return (
    <button
      onClick={() => setLanguage(language === "en" ? "sw" : "en")}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-border bg-background hover:bg-secondary transition-colors"
      aria-label={`Switch to ${language === "en" ? "Swahili" : "English"}`}
    >
      <span className="text-base">{language === "en" ? "🇰🇪" : "🇬🇧"}</span>
      <span>{language === "en" ? "SW" : "EN"}</span>
    </button>
  );
}
