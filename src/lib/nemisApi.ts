/**
 * NEMIS API Service
 * Simulates realistic Ministry of Education NEMIS API integration
 * 
 * NEMIS ID Format: 11 digits
 * - First 3 digits: County code (001-047)
 * - Next 4 digits: School code within the county
 * - Last 4 digits: Student identification number
 * 
 * Example: 00112345678
 * - County: 001 (Mombasa)
 * - School: 1234
 * - Student: 5678
 */

// Kenyan counties with their codes (001-047)
export const kenyanCountyCodes: Record<string, string> = {
  "001": "Mombasa",
  "002": "Kwale",
  "003": "Kilifi",
  "004": "Tana River",
  "005": "Lamu",
  "006": "Taita Taveta",
  "007": "Garissa",
  "008": "Wajir",
  "009": "Mandera",
  "010": "Marsabit",
  "011": "Isiolo",
  "012": "Meru",
  "013": "Tharaka Nithi",
  "014": "Embu",
  "015": "Kitui",
  "016": "Machakos",
  "017": "Makueni",
  "018": "Nyandarua",
  "019": "Nyeri",
  "020": "Kirinyaga",
  "021": "Murang'a",
  "022": "Kiambu",
  "023": "Turkana",
  "024": "West Pokot",
  "025": "Samburu",
  "026": "Trans Nzoia",
  "027": "Uasin Gishu",
  "028": "Elgeyo Marakwet",
  "029": "Nandi",
  "030": "Baringo",
  "031": "Laikipia",
  "032": "Nakuru",
  "033": "Narok",
  "034": "Kajiado",
  "035": "Kericho",
  "036": "Bomet",
  "037": "Kakamega",
  "038": "Vihiga",
  "039": "Bungoma",
  "040": "Busia",
  "041": "Siaya",
  "042": "Kisumu",
  "043": "Homa Bay",
  "044": "Migori",
  "045": "Kisii",
  "046": "Nyamira",
  "047": "Nairobi",
};

// School database - at least 2-3 schools per county
// Format: "CCCSSSS" where CCC is county code and SSSS is school code
const schoolDatabase: Record<string, { name: string; county: string }> = {
  // 001 - Mombasa
  "0011001": { name: "Aga Khan Academy Mombasa", county: "Mombasa" },
  "0011002": { name: "Shimo La Tewa High School", county: "Mombasa" },
  "0011003": { name: "Mama Ngina Girls High School", county: "Mombasa" },
  
  // 002 - Kwale
  "0021001": { name: "Kwale High School", county: "Kwale" },
  "0021002": { name: "Shimba Hills High School", county: "Kwale" },
  "0021003": { name: "Matuga Girls High School", county: "Kwale" },
  
  // 003 - Kilifi
  "0031001": { name: "Kilifi High School", county: "Kilifi" },
  "0031002": { name: "Malindi High School", county: "Kilifi" },
  "0031003": { name: "Barani Girls Secondary School", county: "Kilifi" },
  
  // 004 - Tana River
  "0041001": { name: "Hola High School", county: "Tana River" },
  "0041002": { name: "Ngao Girls High School", county: "Tana River" },
  
  // 005 - Lamu
  "0051001": { name: "Lamu Boys Secondary School", county: "Lamu" },
  "0051002": { name: "Lamu Girls Secondary School", county: "Lamu" },
  
  // 006 - Taita Taveta
  "0061001": { name: "Mwatate High School", county: "Taita Taveta" },
  "0061002": { name: "Wundanyi Secondary School", county: "Taita Taveta" },
  "0061003": { name: "Bura Girls High School", county: "Taita Taveta" },
  
  // 007 - Garissa
  "0071001": { name: "Garissa High School", county: "Garissa" },
  "0071002": { name: "North Eastern Girls High School", county: "Garissa" },
  
  // 008 - Wajir
  "0081001": { name: "Wajir High School", county: "Wajir" },
  "0081002": { name: "Habaswein Secondary School", county: "Wajir" },
  
  // 009 - Mandera
  "0091001": { name: "Mandera High School", county: "Mandera" },
  "0091002": { name: "Rhamu Secondary School", county: "Mandera" },
  
  // 010 - Marsabit
  "0101001": { name: "Marsabit High School", county: "Marsabit" },
  "0101002": { name: "Moyale Girls Secondary School", county: "Marsabit" },
  
  // 011 - Isiolo
  "0111001": { name: "Isiolo Boys High School", county: "Isiolo" },
  "0111002": { name: "Isiolo Girls High School", county: "Isiolo" },
  
  // 012 - Meru
  "0121001": { name: "Meru School", county: "Meru" },
  "0121002": { name: "Nkubu High School", county: "Meru" },
  "0121003": { name: "Kaaga Girls High School", county: "Meru" },
  
  // 013 - Tharaka Nithi
  "0131001": { name: "Chogoria Boys High School", county: "Tharaka Nithi" },
  "0131002": { name: "Chogoria Girls High School", county: "Tharaka Nithi" },
  
  // 014 - Embu
  "0141001": { name: "Kangaru School", county: "Embu" },
  "0141002": { name: "Kyeni Girls High School", county: "Embu" },
  "0141003": { name: "Siakago Boys High School", county: "Embu" },
  
  // 015 - Kitui
  "0151001": { name: "Kitui High School", county: "Kitui" },
  "0151002": { name: "Mulango Girls High School", county: "Kitui" },
  "0151003": { name: "Mutomo Boys High School", county: "Kitui" },
  
  // 016 - Machakos
  "0161001": { name: "Machakos School", county: "Machakos" },
  "0161002": { name: "Machakos Girls High School", county: "Machakos" },
  "0161003": { name: "Mumbuni High School", county: "Machakos" },
  
  // 017 - Makueni
  "0171001": { name: "Makueni Boys High School", county: "Makueni" },
  "0171002": { name: "Wote Girls High School", county: "Makueni" },
  "0171003": { name: "Mbooni Boys High School", county: "Makueni" },
  
  // 018 - Nyandarua
  "0181001": { name: "Nyandarua High School", county: "Nyandarua" },
  "0181002": { name: "Nyahururu High School", county: "Nyandarua" },
  "0181003": { name: "Ol Joro Orok High School", county: "Nyandarua" },
  
  // 019 - Nyeri
  "0191001": { name: "Nyeri High School", county: "Nyeri" },
  "0191002": { name: "Bishop Gatimu Ngandu Girls", county: "Nyeri" },
  "0191003": { name: "Tumutumu High School", county: "Nyeri" },
  
  // 020 - Kirinyaga
  "0201001": { name: "Kerugoya Boys High School", county: "Kirinyaga" },
  "0201002": { name: "Kerugoya Girls High School", county: "Kirinyaga" },
  "0201003": { name: "Baricho Boys High School", county: "Kirinyaga" },
  
  // 021 - Murang'a
  "0211001": { name: "Kagumo High School", county: "Murang'a" },
  "0211002": { name: "Kahuhia Girls High School", county: "Murang'a" },
  "0211003": { name: "Murang'a High School", county: "Murang'a" },
  
  // 022 - Kiambu
  "0221001": { name: "Mang'u High School", county: "Kiambu" },
  "0221002": { name: "Loreto High School Limuru", county: "Kiambu" },
  "0221003": { name: "Kiambu High School", county: "Kiambu" },
  
  // 023 - Turkana
  "0231001": { name: "Lodwar High School", county: "Turkana" },
  "0231002": { name: "Turkana Girls High School", county: "Turkana" },
  
  // 024 - West Pokot
  "0241001": { name: "Kapenguria Boys High School", county: "West Pokot" },
  "0241002": { name: "Kapenguria Girls High School", county: "West Pokot" },
  
  // 025 - Samburu
  "0251001": { name: "Maralal High School", county: "Samburu" },
  "0251002": { name: "Wamba Boys High School", county: "Samburu" },
  
  // 026 - Trans Nzoia
  "0261001": { name: "Kitale School", county: "Trans Nzoia" },
  "0261002": { name: "St. Joseph's Girls Kitale", county: "Trans Nzoia" },
  "0261003": { name: "Cherangany Boys High School", county: "Trans Nzoia" },
  
  // 027 - Uasin Gishu
  "0271001": { name: "Moi Girls School Eldoret", county: "Uasin Gishu" },
  "0271002": { name: "Moi Forces Academy", county: "Uasin Gishu" },
  "0271003": { name: "Hill School Eldoret", county: "Uasin Gishu" },
  
  // 028 - Elgeyo Marakwet
  "0281001": { name: "Kapsowar Boys High School", county: "Elgeyo Marakwet" },
  "0281002": { name: "Tambach High School", county: "Elgeyo Marakwet" },
  "0281003": { name: "Singore Girls High School", county: "Elgeyo Marakwet" },
  
  // 029 - Nandi
  "0291001": { name: "Kapsabet High School", county: "Nandi" },
  "0291002": { name: "Kapsabet Girls High School", county: "Nandi" },
  "0291003": { name: "Sacho High School", county: "Nandi" },
  
  // 030 - Baringo
  "0301001": { name: "Kabarnet High School", county: "Baringo" },
  "0301002": { name: "Tenges Girls High School", county: "Baringo" },
  "0301003": { name: "Marigat Boys High School", county: "Baringo" },
  
  // 031 - Laikipia
  "0311001": { name: "Nanyuki High School", county: "Laikipia" },
  "0311002": { name: "Laikipia High School", county: "Laikipia" },
  "0311003": { name: "Sosian Girls High School", county: "Laikipia" },
  
  // 032 - Nakuru
  "0321001": { name: "Nakuru High School", county: "Nakuru" },
  "0321002": { name: "Moi High School Kabarak", county: "Nakuru" },
  "0321003": { name: "Menengai High School", county: "Nakuru" },
  
  // 033 - Narok
  "0331001": { name: "Narok High School", county: "Narok" },
  "0331002": { name: "Maasai Girls High School", county: "Narok" },
  "0331003": { name: "Kilgoris High School", county: "Narok" },
  
  // 034 - Kajiado
  "0341001": { name: "Kajiado High School", county: "Kajiado" },
  "0341002": { name: "Ongata Rongai High School", county: "Kajiado" },
  "0341003": { name: "AIC Girls Kajiado", county: "Kajiado" },
  
  // 035 - Kericho
  "0351001": { name: "Kericho High School", county: "Kericho" },
  "0351002": { name: "Kericho Tea Girls", county: "Kericho" },
  "0351003": { name: "Moi Tea Boys Kericho", county: "Kericho" },
  
  // 036 - Bomet
  "0361001": { name: "Kaplong Boys High School", county: "Bomet" },
  "0361002": { name: "Kaplong Girls High School", county: "Bomet" },
  "0361003": { name: "Silibwet Boys High School", county: "Bomet" },
  
  // 037 - Kakamega
  "0371001": { name: "Kakamega High School", county: "Kakamega" },
  "0371002": { name: "Mukumu Girls High School", county: "Kakamega" },
  "0371003": { name: "St. Peter's Mumias", county: "Kakamega" },
  
  // 038 - Vihiga
  "0381001": { name: "Chavakali High School", county: "Vihiga" },
  "0381002": { name: "Bunyore Girls High School", county: "Vihiga" },
  "0381003": { name: "Mwangaza High School", county: "Vihiga" },
  
  // 039 - Bungoma
  "0391001": { name: "Friends School Kamusinga", county: "Bungoma" },
  "0391002": { name: "Lugulu Girls High School", county: "Bungoma" },
  "0391003": { name: "Kibabii High School", county: "Bungoma" },
  
  // 040 - Busia
  "0401001": { name: "Busia High School", county: "Busia" },
  "0401002": { name: "Nangina Girls High School", county: "Busia" },
  "0401003": { name: "Port Victoria High School", county: "Busia" },
  
  // 041 - Siaya
  "0411001": { name: "Maranda High School", county: "Siaya" },
  "0411002": { name: "Ng'iya Girls High School", county: "Siaya" },
  "0411003": { name: "Ambira High School", county: "Siaya" },
  
  // 042 - Kisumu
  "0421001": { name: "Maseno School", county: "Kisumu" },
  "0421002": { name: "Kisumu Girls High School", county: "Kisumu" },
  "0421003": { name: "Nyakach High School", county: "Kisumu" },
  
  // 043 - Homa Bay
  "0431001": { name: "Homa Bay High School", county: "Homa Bay" },
  "0431002": { name: "Ogande Girls High School", county: "Homa Bay" },
  "0431003": { name: "Mbita High School", county: "Homa Bay" },
  
  // 044 - Migori
  "0441001": { name: "Migori High School", county: "Migori" },
  "0441002": { name: "Nyabisawa Girls High School", county: "Migori" },
  "0441003": { name: "Rapogi High School", county: "Migori" },
  
  // 045 - Kisii
  "0451001": { name: "Kisii High School", county: "Kisii" },
  "0451002": { name: "Cardinal Otunga High School", county: "Kisii" },
  "0451003": { name: "Kereri Girls High School", county: "Kisii" },
  
  // 046 - Nyamira
  "0461001": { name: "Nyamira High School", county: "Nyamira" },
  "0461002": { name: "Nyabururu Girls High School", county: "Nyamira" },
  "0461003": { name: "Ekerenyo High School", county: "Nyamira" },
  
  // 047 - Nairobi
  "0471001": { name: "Alliance High School", county: "Nairobi" },
  "0471002": { name: "Kenya High School", county: "Nairobi" },
  "0471003": { name: "Nairobi School", county: "Nairobi" },
  "0471004": { name: "Starehe Boys Centre", county: "Nairobi" },
  "0471005": { name: "Precious Blood Riruta", county: "Nairobi" },
  "0471006": { name: "St. Mary's School Nairobi", county: "Nairobi" },
  "0471007": { name: "Strathmore School", county: "Nairobi" },
  "0471008": { name: "Lenana School", county: "Nairobi" },
  "0471009": { name: "Pangani Girls High School", county: "Nairobi" },
};

// Simulated student database linked to NEMIS IDs
const studentDatabase: Record<string, { name: string; schoolCode: string }> = {
  // Nairobi schools
  "04710011234": { name: "John Kamau Mwangi", schoolCode: "0471001" },
  "04710015678": { name: "Peter Wafula Simiyu", schoolCode: "0471001" },
  "04710021234": { name: "Mary Wanjiku Njoroge", schoolCode: "0471002" },
  "04710025678": { name: "Grace Muthoni Kariuki", schoolCode: "0471002" },
  "04710031234": { name: "James Omondi Otieno", schoolCode: "0471003" },
  "04710041234": { name: "Daniel Kipchoge Korir", schoolCode: "0471004" },
  "04710051234": { name: "Faith Nyambura Mwangi", schoolCode: "0471005" },
  "04710091234": { name: "Grace Akinyi Odhiambo", schoolCode: "0471009" },
  // Kiambu schools
  "02210011234": { name: "Samuel Njoroge Maina", schoolCode: "0221001" },
  "02210021234": { name: "Angela Wambui Kamau", schoolCode: "0221002" },
  // Kisumu schools
  "04210011234": { name: "Peter Ochieng Otieno", schoolCode: "0421001" },
  // Uasin Gishu schools
  "02710011234": { name: "Mercy Chebet Kiplagat", schoolCode: "0271001" },
  "02710021234": { name: "David Kiprop Cheruiyot", schoolCode: "0271002" },
  // Other counties
  "02910011234": { name: "Brian Kibet Koech", schoolCode: "0291001" },
  "04510011234": { name: "Edwin Nyakundi Mogeni", schoolCode: "0451001" },
  // Mombasa
  "00110011234": { name: "Hassan Omar Ali", schoolCode: "0011001" },
  "00110021234": { name: "Fatuma Mwanaisha", schoolCode: "0011002" },
  // Siaya
  "04110011234": { name: "Kevin Otieno Ouma", schoolCode: "0411001" },
  // Kakamega
  "03710011234": { name: "Sharon Nekesa Wanyama", schoolCode: "0371001" },
};

export interface NemisValidationResult {
  isValid: boolean;
  error?: string;
  countyCode?: string;
  schoolCode?: string;
  studentNumber?: string;
  countyName?: string;
}

export interface NemisLookupResult {
  success: boolean;
  error?: string;
  data?: {
    studentName: string;
    schoolName: string;
    schoolCode: string;
    countyName: string;
    countyCode: string;
  };
}

/**
 * Validates NEMIS ID format
 * Format: CCC-SSSS-NNNN (11 digits total)
 * CCC = County code (001-047)
 * SSSS = School code
 * NNNN = Student number
 */
export function validateNemisFormat(nemisId: string): NemisValidationResult {
  // Check if it's exactly 11 digits
  if (!/^\d{11}$/.test(nemisId)) {
    return {
      isValid: false,
      error: "NEMIS ID must be exactly 11 digits",
    };
  }

  const countyCode = nemisId.substring(0, 3);
  const schoolCode = nemisId.substring(0, 7); // Full school code includes county
  const studentNumber = nemisId.substring(7, 11);

  // Validate county code (001-047)
  const countyNum = parseInt(countyCode, 10);
  if (countyNum < 1 || countyNum > 47) {
    return {
      isValid: false,
      error: `Invalid county code: ${countyCode}. Must be between 001 and 047`,
    };
  }

  const countyName = kenyanCountyCodes[countyCode];

  return {
    isValid: true,
    countyCode,
    schoolCode,
    studentNumber,
    countyName,
  };
}

/**
 * Simulates NEMIS API lookup with realistic delay
 * In production, this would call the actual Ministry of Education API
 */
export async function lookupNemisId(nemisId: string): Promise<NemisLookupResult> {
  // Validate format first
  const validation = validateNemisFormat(nemisId);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  // Simulate network delay (300-800ms)
  await new Promise((resolve) => 
    setTimeout(resolve, 300 + Math.random() * 500)
  );

  // Check if student exists in our simulated database
  const student = studentDatabase[nemisId];
  
  if (student) {
    const school = schoolDatabase[student.schoolCode];
    if (school) {
      return {
        success: true,
        data: {
          studentName: student.name,
          schoolName: school.name,
          schoolCode: student.schoolCode,
          countyName: school.county,
          countyCode: validation.countyCode!,
        },
      };
    }
  }

  // Generate realistic data for unknown NEMIS IDs based on the school code
  const school = schoolDatabase[validation.schoolCode!];
  
  if (school) {
    // School exists, generate a student name
    const firstNames = ["James", "Mary", "John", "Grace", "Peter", "Faith", "David", "Joy", "Samuel", "Agnes", "Kevin", "Sharon", "Hassan", "Fatuma", "Brian", "Mercy"];
    const middleNames = ["Kamau", "Wanjiku", "Ochieng", "Akinyi", "Kiprop", "Muthoni", "Omondi", "Chebet", "Njoroge", "Wambui", "Otieno", "Nekesa", "Omar", "Mwanaisha"];
    const lastNames = ["Mwangi", "Njoroge", "Otieno", "Odhiambo", "Korir", "Kariuki", "Kimani", "Kiplagat", "Cheruiyot", "Wafula", "Ouma", "Wanyama", "Ali", "Mohammed"];
    
    const randomFirst = firstNames[Math.floor(Math.random() * firstNames.length)];
    const randomMiddle = middleNames[Math.floor(Math.random() * middleNames.length)];
    const randomLast = lastNames[Math.floor(Math.random() * lastNames.length)];
    
    return {
      success: true,
      data: {
        studentName: `${randomFirst} ${randomMiddle} ${randomLast}`,
        schoolName: school.name,
        schoolCode: validation.schoolCode!,
        countyName: school.county,
        countyCode: validation.countyCode!,
      },
    };
  }

  // School not found in database - return error
  return {
    success: false,
    error: `School with code ${validation.schoolCode} not found in NEMIS database. Please verify your NEMIS ID.`,
  };
}

/**
 * Get list of valid school codes for reference
 */
export function getRegisteredSchools(): Array<{ code: string; name: string; county: string }> {
  return Object.entries(schoolDatabase).map(([code, data]) => ({
    code,
    name: data.name,
    county: data.county,
  }));
}

/**
 * Format NEMIS ID for display (XXX-XXXX-XXXX)
 */
export function formatNemisId(nemisId: string): string {
  if (nemisId.length !== 11) return nemisId;
  return `${nemisId.slice(0, 3)}-${nemisId.slice(3, 7)}-${nemisId.slice(7)}`;
}
