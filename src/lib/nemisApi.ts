/**
 * NEMIS API Service
 * Simulates realistic Ministry of Education NEMIS API integration
 * 
 * NEMIS ID Format: 14 digits
 * - First 2 digits: County code (01-47)
 * - Next 4 digits: School code within the county
 * - Last 8 digits: Student identification number
 * 
 * Example: 01123400012345
 * - County: 01 (Mombasa)
 * - School: 1234
 * - Student: 00012345
 */

// Kenyan counties with their codes
export const kenyanCountyCodes: Record<string, string> = {
  "01": "Mombasa",
  "02": "Kwale",
  "03": "Kilifi",
  "04": "Tana River",
  "05": "Lamu",
  "06": "Taita Taveta",
  "07": "Garissa",
  "08": "Wajir",
  "09": "Mandera",
  "10": "Marsabit",
  "11": "Isiolo",
  "12": "Meru",
  "13": "Tharaka Nithi",
  "14": "Embu",
  "15": "Kitui",
  "16": "Machakos",
  "17": "Makueni",
  "18": "Nyandarua",
  "19": "Nyeri",
  "20": "Kirinyaga",
  "21": "Murang'a",
  "22": "Kiambu",
  "23": "Turkana",
  "24": "West Pokot",
  "25": "Samburu",
  "26": "Trans Nzoia",
  "27": "Uasin Gishu",
  "28": "Elgeyo Marakwet",
  "29": "Nandi",
  "30": "Baringo",
  "31": "Laikipia",
  "32": "Nakuru",
  "33": "Narok",
  "34": "Kajiado",
  "35": "Kericho",
  "36": "Bomet",
  "37": "Kakamega",
  "38": "Vihiga",
  "39": "Bungoma",
  "40": "Busia",
  "41": "Siaya",
  "42": "Kisumu",
  "43": "Homa Bay",
  "44": "Migori",
  "45": "Kisii",
  "46": "Nyamira",
  "47": "Nairobi",
};

// School code to school name mapping (simulated database)
const schoolDatabase: Record<string, { name: string; county: string }> = {
  "471001": { name: "Alliance High School", county: "Nairobi" },
  "471002": { name: "Kenya High School", county: "Nairobi" },
  "471003": { name: "Nairobi School", county: "Nairobi" },
  "471004": { name: "Starehe Boys Centre", county: "Nairobi" },
  "471005": { name: "Precious Blood Riruta", county: "Nairobi" },
  "471006": { name: "St. Mary's School Nairobi", county: "Nairobi" },
  "471007": { name: "Strathmore School", county: "Nairobi" },
  "471008": { name: "Lenana School", county: "Nairobi" },
  "471009": { name: "Pangani Girls High School", county: "Nairobi" },
  "221001": { name: "Mang'u High School", county: "Kiambu" },
  "221002": { name: "Loreto High School Limuru", county: "Kiambu" },
  "421001": { name: "Maseno School", county: "Kisumu" },
  "411001": { name: "Maranda High School", county: "Siaya" },
  "271001": { name: "Moi Girls School Eldoret", county: "Uasin Gishu" },
  "271002": { name: "Moi Forces Academy", county: "Uasin Gishu" },
  "391001": { name: "Friends School Kamusinga", county: "Bungoma" },
  "291001": { name: "Kapsabet High School", county: "Nandi" },
  "381001": { name: "Chavakali High School", county: "Vihiga" },
  "451001": { name: "Kisii High School", county: "Kisii" },
  "011001": { name: "Aga Khan Academy Mombasa", county: "Mombasa" },
  "011002": { name: "Shimo La Tewa High School", county: "Mombasa" },
  "321001": { name: "Nakuru High School", county: "Nakuru" },
  "321002": { name: "Moi High School Kabarak", county: "Nakuru" },
};

// Simulated student database linked to NEMIS IDs
const studentDatabase: Record<string, { name: string; schoolCode: string }> = {
  // Nairobi schools
  "47100100001234": { name: "John Kamau Mwangi", schoolCode: "471001" },
  "47100100005678": { name: "Peter Wafula Simiyu", schoolCode: "471001" },
  "47100200001234": { name: "Mary Wanjiku Njoroge", schoolCode: "471002" },
  "47100200005678": { name: "Grace Muthoni Kariuki", schoolCode: "471002" },
  "47100300001234": { name: "James Omondi Otieno", schoolCode: "471003" },
  "47100400001234": { name: "Daniel Kipchoge Korir", schoolCode: "471004" },
  "47100500001234": { name: "Faith Nyambura Mwangi", schoolCode: "471005" },
  "47100900001234": { name: "Grace Akinyi Odhiambo", schoolCode: "471009" },
  // Kiambu schools
  "22100100001234": { name: "Samuel Njoroge Maina", schoolCode: "221001" },
  "22100200001234": { name: "Angela Wambui Kamau", schoolCode: "221002" },
  // Kisumu schools
  "42100100001234": { name: "Peter Ochieng Otieno", schoolCode: "421001" },
  // Uasin Gishu schools
  "27100100001234": { name: "Mercy Chebet Kiplagat", schoolCode: "271001" },
  "27100200001234": { name: "David Kiprop Cheruiyot", schoolCode: "271002" },
  // Other counties
  "29100100001234": { name: "Brian Kibet Koech", schoolCode: "291001" },
  "45100100001234": { name: "Edwin Nyakundi Mogeni", schoolCode: "451001" },
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
 * Format: CC-SSSS-NNNNNNNN (14 digits total)
 * CC = County code (01-47)
 * SSSS = School code
 * NNNNNNNN = Student number
 */
export function validateNemisFormat(nemisId: string): NemisValidationResult {
  // Check if it's exactly 14 digits
  if (!/^\d{14}$/.test(nemisId)) {
    return {
      isValid: false,
      error: "NEMIS ID must be exactly 14 digits",
    };
  }

  const countyCode = nemisId.substring(0, 2);
  const schoolCode = nemisId.substring(0, 6); // Full school code includes county
  const studentNumber = nemisId.substring(6, 14);

  // Validate county code (01-47)
  const countyNum = parseInt(countyCode, 10);
  if (countyNum < 1 || countyNum > 47) {
    return {
      isValid: false,
      error: `Invalid county code: ${countyCode}. Must be between 01 and 47`,
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
    const firstNames = ["James", "Mary", "John", "Grace", "Peter", "Faith", "David", "Joy", "Samuel", "Agnes"];
    const middleNames = ["Kamau", "Wanjiku", "Ochieng", "Akinyi", "Kiprop", "Muthoni", "Omondi", "Chebet", "Njoroge", "Wambui"];
    const lastNames = ["Mwangi", "Njoroge", "Otieno", "Odhiambo", "Korir", "Kariuki", "Kimani", "Kiplagat", "Cheruiyot", "Wafula"];
    
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
 * Format NEMIS ID for display (XX-XXXX-XXXXXXXX)
 */
export function formatNemisId(nemisId: string): string {
  if (nemisId.length !== 14) return nemisId;
  return `${nemisId.slice(0, 2)}-${nemisId.slice(2, 6)}-${nemisId.slice(6)}`;
}
