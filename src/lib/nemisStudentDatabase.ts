/**
 * NEMIS Student Database
 * Simulated database of students from the Kenya Ministry of Education NEMIS system
 * Contains unique 11-digit NEMIS IDs evenly distributed across all 47 counties
 * 
 * Format: CCC-SSSS-NNNN
 * - CCC: County code (001-047)
 * - SSSS: School code
 * - NNNN: Student number (unique per school)
 */

export interface NemisStudent {
  nemisId: string;
  name: string;
  schoolCode: string;
  classForm: "Form 1" | "Form 2" | "Form 3" | "Form 4";
  gender: "Male" | "Female";
  dateOfBirth: string;
}

// First names by gender
const maleFirstNames = [
  "James", "John", "Peter", "David", "Samuel", "Daniel", "Kevin", "Brian",
  "Emmanuel", "Joseph", "Michael", "George", "Patrick", "Paul", "Moses",
  "Stephen", "Anthony", "Victor", "Dennis", "Francis", "Charles", "Hassan",
  "Ahmed", "Omar", "Ibrahim", "Kipchoge", "Kiprotich", "Rotich", "Chebet"
];

const femaleFirstNames = [
  "Mary", "Grace", "Faith", "Joy", "Agnes", "Mercy", "Sharon", "Lucy",
  "Elizabeth", "Esther", "Sarah", "Ruth", "Nancy", "Catherine", "Jane",
  "Ann", "Susan", "Alice", "Florence", "Pauline", "Teresa", "Fatuma",
  "Aisha", "Zainab", "Halima", "Chebet", "Jepkosgei", "Chelimo", "Nekesa"
];

// Middle names by region/tribe
const centralMiddleNames = ["Kamau", "Njoroge", "Mwangi", "Kariuki", "Kimani", "Wambui", "Muthoni", "Wanjiku", "Nyambura"];
const coastalMiddleNames = ["Omar", "Ali", "Hassan", "Mwanaisha", "Bakari", "Salim", "Mwajuma", "Zuhura"];
const westernMiddleNames = ["Omondi", "Otieno", "Ochieng", "Akinyi", "Adhiambo", "Ouma", "Nekesa", "Wanyama"];
const riftMiddleNames = ["Kiprop", "Korir", "Kiplagat", "Cheruiyot", "Chebet", "Jepkosgei", "Kibet", "Koech"];
const easternMiddleNames = ["Mutua", "Mwende", "Musyoka", "Mueni", "Kilonzo", "Wambua", "Ndinda"];
const northEasternMiddleNames = ["Mohamed", "Abdi", "Hussein", "Halima", "Amina", "Farah", "Yusuf"];
const nyanzaMiddleNames = ["Onyango", "Okoth", "Oduor", "Nyaboke", "Kwamboka", "Mogeni", "Nyakundi"];

// Last names
const lastNames = [
  "Mwangi", "Njoroge", "Otieno", "Odhiambo", "Korir", "Kariuki", "Kimani",
  "Kiplagat", "Cheruiyot", "Wafula", "Ouma", "Wanyama", "Ali", "Mohammed",
  "Kamau", "Musyoka", "Mutua", "Makau", "Rotich", "Kibet", "Koech",
  "Kiptoo", "Baraza", "Simiyu", "Wekesa", "Masinde", "Juma", "Ombati"
];

// Get regional middle names based on county code
function getRegionalMiddleNames(countyCode: string): string[] {
  const county = parseInt(countyCode, 10);
  
  // Coast (1-6)
  if (county >= 1 && county <= 6) return coastalMiddleNames;
  // North Eastern (7-11)
  if (county >= 7 && county <= 11) return northEasternMiddleNames;
  // Eastern (12-17)
  if (county >= 12 && county <= 17) return easternMiddleNames;
  // Central (18-22)
  if (county >= 18 && county <= 22) return centralMiddleNames;
  // Rift Valley (23-36)
  if (county >= 23 && county <= 36) return riftMiddleNames;
  // Western (37-40)
  if (county >= 37 && county <= 40) return westernMiddleNames;
  // Nyanza (41-46)
  if (county >= 41 && county <= 46) return nyanzaMiddleNames;
  // Nairobi (47)
  return [...centralMiddleNames, ...westernMiddleNames, ...nyanzaMiddleNames];
}

// Generate random date of birth for secondary school student
function generateDOB(classForm: string): string {
  const currentYear = new Date().getFullYear();
  let birthYear: number;
  
  switch (classForm) {
    case "Form 1": birthYear = currentYear - 14 - Math.floor(Math.random() * 2); break;
    case "Form 2": birthYear = currentYear - 15 - Math.floor(Math.random() * 2); break;
    case "Form 3": birthYear = currentYear - 16 - Math.floor(Math.random() * 2); break;
    case "Form 4": birthYear = currentYear - 17 - Math.floor(Math.random() * 2); break;
    default: birthYear = currentYear - 15;
  }
  
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  
  return `${birthYear}-${month}-${day}`;
}

// School codes organized by county (3-digit county + 4-digit school)
const schoolCodes: Record<string, string[]> = {
  "001": ["0011001", "0011002", "0011003"], // Mombasa
  "002": ["0021001", "0021002", "0021003"], // Kwale
  "003": ["0031001", "0031002", "0031003"], // Kilifi
  "004": ["0041001", "0041002"],             // Tana River
  "005": ["0051001", "0051002"],             // Lamu
  "006": ["0061001", "0061002", "0061003"], // Taita Taveta
  "007": ["0071001", "0071002"],             // Garissa
  "008": ["0081001", "0081002"],             // Wajir
  "009": ["0091001", "0091002"],             // Mandera
  "010": ["0101001", "0101002"],             // Marsabit
  "011": ["0111001", "0111002"],             // Isiolo
  "012": ["0121001", "0121002", "0121003"], // Meru
  "013": ["0131001", "0131002"],             // Tharaka Nithi
  "014": ["0141001", "0141002", "0141003"], // Embu
  "015": ["0151001", "0151002", "0151003"], // Kitui
  "016": ["0161001", "0161002", "0161003"], // Machakos
  "017": ["0171001", "0171002", "0171003"], // Makueni
  "018": ["0181001", "0181002", "0181003"], // Nyandarua
  "019": ["0191001", "0191002", "0191003"], // Nyeri
  "020": ["0201001", "0201002", "0201003"], // Kirinyaga
  "021": ["0211001", "0211002", "0211003"], // Murang'a
  "022": ["0221001", "0221002", "0221003"], // Kiambu
  "023": ["0231001", "0231002"],             // Turkana
  "024": ["0241001", "0241002"],             // West Pokot
  "025": ["0251001", "0251002"],             // Samburu
  "026": ["0261001", "0261002", "0261003"], // Trans Nzoia
  "027": ["0271001", "0271002", "0271003"], // Uasin Gishu
  "028": ["0281001", "0281002", "0281003"], // Elgeyo Marakwet
  "029": ["0291001", "0291002", "0291003"], // Nandi
  "030": ["0301001", "0301002", "0301003"], // Baringo
  "031": ["0311001", "0311002", "0311003"], // Laikipia
  "032": ["0321001", "0321002", "0321003"], // Nakuru
  "033": ["0331001", "0331002", "0331003"], // Narok
  "034": ["0341001", "0341002", "0341003"], // Kajiado
  "035": ["0351001", "0351002", "0351003"], // Kericho
  "036": ["0361001", "0361002", "0361003"], // Bomet
  "037": ["0371001", "0371002", "0371003"], // Kakamega
  "038": ["0381001", "0381002", "0381003"], // Vihiga
  "039": ["0391001", "0391002", "0391003"], // Bungoma
  "040": ["0401001", "0401002", "0401003"], // Busia
  "041": ["0411001", "0411002", "0411003"], // Siaya
  "042": ["0421001", "0421002", "0421003"], // Kisumu
  "043": ["0431001", "0431002", "0431003"], // Homa Bay
  "044": ["0441001", "0441002", "0441003"], // Migori
  "045": ["0451001", "0451002", "0451003"], // Kisii
  "046": ["0461001", "0461002", "0461003"], // Nyamira
  "047": ["0471001", "0471002", "0471003", "0471004", "0471005", "0471006", "0471007", "0471008", "0471009"], // Nairobi
};

// Generate unique student numbers to avoid duplicates
const usedStudentNumbers = new Set<string>();

function generateUniqueStudentNumber(): string {
  let studentNum: string;
  do {
    studentNum = String(Math.floor(1000 + Math.random() * 9000));
  } while (usedStudentNumbers.has(studentNum));
  usedStudentNumbers.add(studentNum);
  return studentNum;
}

// Generate a student for a specific school
function generateStudent(schoolCode: string, studentNum: string): NemisStudent {
  const countyCode = schoolCode.substring(0, 3);
  const nemisId = schoolCode + studentNum;
  const gender: "Male" | "Female" = Math.random() > 0.5 ? "Male" : "Female";
  const classForm: "Form 1" | "Form 2" | "Form 3" | "Form 4" = 
    ["Form 1", "Form 2", "Form 3", "Form 4"][Math.floor(Math.random() * 4)] as any;
  
  const firstNames = gender === "Male" ? maleFirstNames : femaleFirstNames;
  const middleNames = getRegionalMiddleNames(countyCode);
  
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const middleName = middleNames[Math.floor(Math.random() * middleNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  
  return {
    nemisId,
    name: `${firstName} ${middleName} ${lastName}`,
    schoolCode,
    classForm,
    gender,
    dateOfBirth: generateDOB(classForm),
  };
}

// Pre-generated student database - evenly distributed across all 47 counties
// Each county gets 20-30 students to total ~1000 students
function generateStudentDatabase(): Map<string, NemisStudent> {
  const database = new Map<string, NemisStudent>();
  const studentsPerCounty = 22; // Roughly 22 per county = ~1000 total
  
  Object.entries(schoolCodes).forEach(([countyCode, schools]) => {
    const studentsPerSchool = Math.ceil(studentsPerCounty / schools.length);
    
    schools.forEach(schoolCode => {
      for (let i = 0; i < studentsPerSchool; i++) {
        const studentNum = generateUniqueStudentNumber();
        const student = generateStudent(schoolCode, studentNum);
        database.set(student.nemisId, student);
      }
    });
  });
  
  return database;
}

// Export the pre-generated database
export const nemisStudentDatabase: Map<string, NemisStudent> = generateStudentDatabase();

// Get all students as an array
export function getAllStudents(): NemisStudent[] {
  return Array.from(nemisStudentDatabase.values());
}

// Look up a student by NEMIS ID
export function lookupStudentByNemisId(nemisId: string): NemisStudent | undefined {
  return nemisStudentDatabase.get(nemisId);
}

// Get students by county
export function getStudentsByCounty(countyCode: string): NemisStudent[] {
  return Array.from(nemisStudentDatabase.values()).filter(
    student => student.nemisId.startsWith(countyCode)
  );
}

// Get students by school
export function getStudentsBySchool(schoolCode: string): NemisStudent[] {
  return Array.from(nemisStudentDatabase.values()).filter(
    student => student.schoolCode === schoolCode
  );
}

// Get sample NEMIS IDs for testing (one per county)
export function getSampleNemisIds(): string[] {
  const samples: string[] = [];
  const seenCounties = new Set<string>();
  
  for (const [nemisId, student] of nemisStudentDatabase) {
    const countyCode = nemisId.substring(0, 3);
    if (!seenCounties.has(countyCode)) {
      seenCounties.add(countyCode);
      samples.push(nemisId);
    }
    if (samples.length >= 47) break;
  }
  
  return samples;
}

// Statistics about the database
export function getDatabaseStats(): {
  totalStudents: number;
  studentsByCounty: Record<string, number>;
  studentsByForm: Record<string, number>;
  genderDistribution: Record<string, number>;
} {
  const students = getAllStudents();
  
  const studentsByCounty: Record<string, number> = {};
  const studentsByForm: Record<string, number> = { "Form 1": 0, "Form 2": 0, "Form 3": 0, "Form 4": 0 };
  const genderDistribution: Record<string, number> = { Male: 0, Female: 0 };
  
  students.forEach(student => {
    const countyCode = student.nemisId.substring(0, 3);
    studentsByCounty[countyCode] = (studentsByCounty[countyCode] || 0) + 1;
    studentsByForm[student.classForm]++;
    genderDistribution[student.gender]++;
  });
  
  return {
    totalStudents: students.length,
    studentsByCounty,
    studentsByForm,
    genderDistribution,
  };
}
