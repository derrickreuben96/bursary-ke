/**
 * Poverty Assessment Questions
 * Randomized questions for fair assessment
 * Includes disability-related questions
 */

export interface PovertyQuestion {
  id: string;
  question: string;
  type: "dropdown" | "checkbox" | "number";
  options?: { value: string; label: string; score: number }[];
  category: "income" | "housing" | "employment" | "health" | "education" | "assets" | "vulnerability";
  weight: number; // Weight in scoring (1-10)
}

// All possible questions - system randomly selects from these
const allQuestions: PovertyQuestion[] = [
  // Income questions (pick 1-2)
  {
    id: "monthly_income",
    question: "What is your household's average monthly income?",
    type: "dropdown",
    category: "income",
    weight: 10,
    options: [
      { value: "below_5000", label: "Below KES 5,000", score: 100 },
      { value: "5000_10000", label: "KES 5,000 - 10,000", score: 80 },
      { value: "10000_20000", label: "KES 10,000 - 20,000", score: 60 },
      { value: "20000_40000", label: "KES 20,000 - 40,000", score: 40 },
      { value: "40000_60000", label: "KES 40,000 - 60,000", score: 20 },
      { value: "above_60000", label: "Above KES 60,000", score: 0 },
    ],
  },
  {
    id: "income_source",
    question: "What is the primary source of household income?",
    type: "dropdown",
    category: "income",
    weight: 7,
    options: [
      { value: "none", label: "No regular income", score: 100 },
      { value: "casual_labor", label: "Casual/Daily labor", score: 85 },
      { value: "small_business", label: "Small business/Hawking", score: 60 },
      { value: "farming", label: "Subsistence farming", score: 70 },
      { value: "formal_employment", label: "Formal employment (1 parent)", score: 30 },
      { value: "both_employed", label: "Both parents formally employed", score: 0 },
    ],
  },
  {
    id: "income_stability",
    question: "How stable is your household income?",
    type: "dropdown",
    category: "income",
    weight: 6,
    options: [
      { value: "very_unstable", label: "Very unstable/No income at all", score: 100 },
      { value: "unstable", label: "Unstable (changes monthly)", score: 75 },
      { value: "somewhat_stable", label: "Somewhat stable", score: 40 },
      { value: "stable", label: "Stable and reliable", score: 0 },
    ],
  },

  // Housing questions (pick 1-2)
  {
    id: "housing_type",
    question: "What type of housing does your family live in?",
    type: "dropdown",
    category: "housing",
    weight: 8,
    options: [
      { value: "informal", label: "Informal settlement/Slum", score: 100 },
      { value: "temporary", label: "Temporary structure (mabati)", score: 85 },
      { value: "rented_single", label: "Rented single room", score: 70 },
      { value: "rented_house", label: "Rented house", score: 40 },
      { value: "owned_simple", label: "Owned simple house", score: 20 },
      { value: "owned_permanent", label: "Owned permanent house", score: 0 },
    ],
  },
  {
    id: "housing_occupants",
    question: "How many people live in your household?",
    type: "dropdown",
    category: "housing",
    weight: 5,
    options: [
      { value: "above_10", label: "More than 10 people", score: 100 },
      { value: "8_10", label: "8 - 10 people", score: 80 },
      { value: "6_7", label: "6 - 7 people", score: 60 },
      { value: "4_5", label: "4 - 5 people", score: 40 },
      { value: "2_3", label: "2 - 3 people", score: 20 },
      { value: "1", label: "1 person", score: 50 }, // Single person might indicate vulnerability
    ],
  },
  {
    id: "housing_rooms",
    question: "How many rooms does your family occupy?",
    type: "dropdown",
    category: "housing",
    weight: 5,
    options: [
      { value: "one", label: "One room only", score: 100 },
      { value: "two", label: "Two rooms", score: 70 },
      { value: "three", label: "Three rooms", score: 40 },
      { value: "four_plus", label: "Four or more rooms", score: 0 },
    ],
  },

  // Employment questions (pick 1)
  {
    id: "parent_employment",
    question: "What is the employment status of your parents/guardians?",
    type: "dropdown",
    category: "employment",
    weight: 9,
    options: [
      { value: "both_unemployed", label: "Both parents unemployed", score: 100 },
      { value: "deceased_na", label: "Parents deceased/Not applicable", score: 95 },
      { value: "one_casual", label: "One parent with casual work", score: 80 },
      { value: "one_employed", label: "One parent employed", score: 50 },
      { value: "self_employed", label: "Self-employed (small scale)", score: 60 },
      { value: "both_employed", label: "Both parents employed", score: 0 },
    ],
  },
  {
    id: "breadwinner",
    question: "Who is the main breadwinner in your household?",
    type: "dropdown",
    category: "employment",
    weight: 7,
    options: [
      { value: "orphan_self", label: "I take care of myself (orphan)", score: 100 },
      { value: "grandparent", label: "Elderly grandparent", score: 90 },
      { value: "single_parent", label: "Single parent", score: 75 },
      { value: "sibling", label: "Older sibling", score: 80 },
      { value: "both_parents", label: "Both parents", score: 20 },
      { value: "guardian", label: "Guardian/Relative", score: 60 },
    ],
  },

  // Health/Disability questions (pick 1-2) - CRITICAL
  {
    id: "disability_student",
    question: "Does the student have any form of disability?",
    type: "dropdown",
    category: "health",
    weight: 10,
    options: [
      { value: "severe_physical", label: "Yes - Severe physical disability", score: 100 },
      { value: "visual_impairment", label: "Yes - Visual impairment/Blind", score: 95 },
      { value: "hearing_impairment", label: "Yes - Hearing impairment/Deaf", score: 95 },
      { value: "intellectual", label: "Yes - Intellectual disability", score: 90 },
      { value: "mild_disability", label: "Yes - Mild disability", score: 70 },
      { value: "chronic_illness", label: "Yes - Chronic illness requiring treatment", score: 80 },
      { value: "no_disability", label: "No disability", score: 0 },
    ],
  },
  {
    id: "disability_family",
    question: "Are there family members with disabilities requiring care?",
    type: "dropdown",
    category: "health",
    weight: 8,
    options: [
      { value: "multiple", label: "Yes - Multiple family members", score: 100 },
      { value: "parent_disabled", label: "Yes - Parent/Guardian disabled", score: 90 },
      { value: "sibling_disabled", label: "Yes - Sibling with disability", score: 75 },
      { value: "elderly_care", label: "Yes - Elderly requiring full-time care", score: 70 },
      { value: "no", label: "No family members with disabilities", score: 0 },
    ],
  },
  {
    id: "health_challenges",
    question: "Does your household face any ongoing health challenges?",
    type: "dropdown",
    category: "health",
    weight: 7,
    options: [
      { value: "hiv_aids", label: "Living with HIV/AIDS", score: 85 },
      { value: "chronic_illness", label: "Chronic illness (diabetes, cancer, etc.)", score: 80 },
      { value: "mental_health", label: "Mental health conditions", score: 75 },
      { value: "multiple_conditions", label: "Multiple health conditions", score: 95 },
      { value: "minor_issues", label: "Minor health issues only", score: 20 },
      { value: "no_issues", label: "No significant health challenges", score: 0 },
    ],
  },

  // Education questions (pick 1)
  {
    id: "siblings_in_school",
    question: "How many other siblings are currently in school/college?",
    type: "dropdown",
    category: "education",
    weight: 6,
    options: [
      { value: "five_plus", label: "5 or more siblings", score: 100 },
      { value: "four", label: "4 siblings", score: 80 },
      { value: "three", label: "3 siblings", score: 60 },
      { value: "two", label: "2 siblings", score: 40 },
      { value: "one", label: "1 sibling", score: 20 },
      { value: "none", label: "No other siblings in school", score: 0 },
    ],
  },
  {
    id: "school_fees_status",
    question: "What is the current status of school fees?",
    type: "dropdown",
    category: "education",
    weight: 8,
    options: [
      { value: "severely_behind", label: "Severely behind (over 1 year)", score: 100 },
      { value: "behind_term", label: "Behind by more than 1 term", score: 85 },
      { value: "current_term_unpaid", label: "Current term not fully paid", score: 70 },
      { value: "sometimes_late", label: "Sometimes paid late", score: 40 },
      { value: "always_current", label: "Always paid on time", score: 0 },
    ],
  },

  // Assets questions (pick 1)
  {
    id: "household_assets",
    question: "Which of these does your household have?",
    type: "dropdown",
    category: "assets",
    weight: 5,
    options: [
      { value: "none", label: "None of the below", score: 100 },
      { value: "radio_only", label: "Radio only", score: 80 },
      { value: "tv_phone", label: "TV and basic phone", score: 50 },
      { value: "smartphone", label: "Smartphone", score: 30 },
      { value: "multiple", label: "Multiple electronics (TV, fridge, etc.)", score: 0 },
    ],
  },
  {
    id: "utilities_access",
    question: "Which utilities do you have access to?",
    type: "dropdown",
    category: "assets",
    weight: 6,
    options: [
      { value: "none", label: "No electricity, no piped water", score: 100 },
      { value: "water_only", label: "Communal water point only", score: 75 },
      { value: "electricity_no_water", label: "Electricity but no piped water", score: 60 },
      { value: "basic", label: "Basic electricity and water", score: 30 },
      { value: "full", label: "Electricity, water, and internet", score: 0 },
    ],
  },

  // Vulnerability questions (pick 1-2)
  {
    id: "orphan_status",
    question: "What is the orphan status of the student?",
    type: "dropdown",
    category: "vulnerability",
    weight: 10,
    options: [
      { value: "total_orphan", label: "Total orphan (both parents deceased)", score: 100 },
      { value: "paternal_orphan", label: "Paternal orphan (father deceased)", score: 80 },
      { value: "maternal_orphan", label: "Maternal orphan (mother deceased)", score: 85 },
      { value: "abandoned", label: "Abandoned by parents", score: 95 },
      { value: "parents_alive", label: "Both parents alive", score: 0 },
    ],
  },
  {
    id: "special_circumstances",
    question: "Are there any special circumstances affecting the household?",
    type: "dropdown",
    category: "vulnerability",
    weight: 8,
    options: [
      { value: "disaster_victim", label: "Recent disaster victim (fire, flood)", score: 100 },
      { value: "displaced", label: "Internally displaced family", score: 95 },
      { value: "single_parent_death", label: "Recent death of breadwinner", score: 90 },
      { value: "abuse_survivor", label: "Survivor of abuse/violence", score: 85 },
      { value: "refugee", label: "Refugee/Asylum seeker", score: 90 },
      { value: "none", label: "No special circumstances", score: 0 },
    ],
  },
  {
    id: "food_security",
    question: "How would you describe your household's food security?",
    type: "dropdown",
    category: "vulnerability",
    weight: 9,
    options: [
      { value: "severe_insecurity", label: "Often go hungry (miss meals daily)", score: 100 },
      { value: "moderate_insecurity", label: "Sometimes skip meals (weekly)", score: 75 },
      { value: "mild_insecurity", label: "Occasionally worried about food", score: 40 },
      { value: "secure", label: "Food secure (3 meals daily)", score: 0 },
    ],
  },
  {
    id: "receives_other_aid",
    question: "Does your household receive any other form of assistance?",
    type: "dropdown",
    category: "vulnerability",
    weight: 4,
    options: [
      { value: "no_aid", label: "No assistance at all", score: 80 },
      { value: "occasional", label: "Occasional help from relatives", score: 50 },
      { value: "cash_transfer", label: "Government cash transfer program", score: 30 },
      { value: "ngo_support", label: "NGO/Church support", score: 20 },
      { value: "multiple_sources", label: "Multiple sources of support", score: 0 },
    ],
  },
];

// Shuffle array using Fisher-Yates algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Get questions for a session - randomized but balanced
export function getRandomizedQuestions(count: number = 8): PovertyQuestion[] {
  const selectedQuestions: PovertyQuestion[] = [];
  
  // Ensure we always include at least one disability question
  const disabilityQuestions = allQuestions.filter(q => q.id.includes("disability"));
  const shuffledDisability = shuffleArray(disabilityQuestions);
  selectedQuestions.push(shuffledDisability[0]);
  
  // Ensure one income question
  const incomeQuestions = allQuestions.filter(q => q.category === "income");
  const shuffledIncome = shuffleArray(incomeQuestions);
  selectedQuestions.push(shuffledIncome[0]);
  
  // Ensure one housing question
  const housingQuestions = allQuestions.filter(q => q.category === "housing");
  const shuffledHousing = shuffleArray(housingQuestions);
  selectedQuestions.push(shuffledHousing[0]);
  
  // Ensure one employment question
  const employmentQuestions = allQuestions.filter(q => q.category === "employment");
  const shuffledEmployment = shuffleArray(employmentQuestions);
  selectedQuestions.push(shuffledEmployment[0]);
  
  // Ensure one vulnerability question
  const vulnerabilityQuestions = allQuestions.filter(q => q.category === "vulnerability");
  const shuffledVulnerability = shuffleArray(vulnerabilityQuestions);
  selectedQuestions.push(shuffledVulnerability[0]);
  
  // Fill remaining slots with random questions from other categories
  const usedIds = new Set(selectedQuestions.map(q => q.id));
  const remainingQuestions = allQuestions.filter(q => !usedIds.has(q.id));
  const shuffledRemaining = shuffleArray(remainingQuestions);
  
  const slotsToFill = count - selectedQuestions.length;
  for (let i = 0; i < slotsToFill && i < shuffledRemaining.length; i++) {
    selectedQuestions.push(shuffledRemaining[i]);
  }
  
  // Final shuffle to randomize order
  return shuffleArray(selectedQuestions);
}

// Calculate score from answers
export function calculatePovertyScoreFromAnswers(
  answers: Record<string, string>,
  questions: PovertyQuestion[]
): { score: number; maxPossible: number; percentage: number } {
  let totalScore = 0;
  let totalWeight = 0;
  
  questions.forEach(question => {
    const answer = answers[question.id];
    if (answer && question.options) {
      const option = question.options.find(o => o.value === answer);
      if (option) {
        totalScore += option.score * question.weight;
        totalWeight += 100 * question.weight; // Max possible for this question
      }
    }
  });
  
  // Normalize to 0-100
  const percentage = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;
  
  return {
    score: totalScore,
    maxPossible: totalWeight,
    percentage,
  };
}

// Get poverty tier from percentage
export function getPovertyTierFromPercentage(percentage: number): "Low" | "Medium" | "High" {
  if (percentage >= 70) return "High";
  if (percentage >= 40) return "Medium";
  return "Low";
}

// Export all questions for reference
export function getAllQuestions(): PovertyQuestion[] {
  return allQuestions;
}
