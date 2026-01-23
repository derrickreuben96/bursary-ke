import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useApplication } from "@/context/ApplicationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowLeft, ArrowRight, Check, ChevronsUpDown, School, User, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { maskName } from "@/lib/maskData";
import { validateNemisFormat, lookupNemisId, formatNemisId, type NemisLookupResult } from "@/lib/nemisApi";

// Fallback schools list for manual selection
const kenyanSchools = [
  "Alliance High School",
  "Kenya High School",
  "Mang'u High School",
  "Starehe Boys Centre",
  "Loreto High School Limuru",
  "Nairobi School",
  "Maseno School",
  "Maranda High School",
  "Moi Forces Academy",
  "Precious Blood Riruta",
  "St. Mary's School Nairobi",
  "Strathmore School",
  "Lenana School",
  "Pangani Girls High School",
  "Moi Girls School Eldoret",
  "Friends School Kamusinga",
  "Kapsabet High School",
  "Chavakali High School",
  "Kisii High School",
  "Other (specify)",
];

// Enhanced validation schema with NEMIS format validation (11 digits)
const secondaryStudentSchema = z.object({
  nemisId: z
    .string()
    .min(1, "NEMIS ID is required")
    .length(11, "NEMIS ID must be exactly 11 digits")
    .regex(/^\d{11}$/, "NEMIS ID must contain only digits")
    .refine((val) => {
      const countyCode = parseInt(val.substring(0, 3), 10);
      return countyCode >= 1 && countyCode <= 47;
    }, "Invalid county code. First 3 digits must be 001-047"),
  studentName: z.string().min(2, "Student name is required"),
  classForm: z.string().min(1, "Class/Form is required"),
  school: z.string().min(1, "School is required"),
});

type SecondaryStudentFormData = z.infer<typeof secondaryStudentSchema>;

interface SecondaryStudentFormProps {
  onNext: () => void;
  onBack: () => void;
}

interface StudentData {
  name: string;
  school: string;
  countyName: string;
  schoolCode: string;
}

export function SecondaryStudentForm({ onNext, onBack }: SecondaryStudentFormProps) {
  const { data, updateData } = useApplication();
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [simulatedStudent, setSimulatedStudent] = useState<StudentData | null>(null);
  
  const form = useForm<SecondaryStudentFormData>({
    resolver: zodResolver(secondaryStudentSchema),
    defaultValues: {
      nemisId: "",
      studentName: "",
      classForm: "",
      school: "",
    },
  });

  // NEMIS API lookup with validation
  const handleNemisLookup = useCallback(async (nemisId: string) => {
    // Clear previous state
    setLookupError(null);
    
    // Only validate format when we have 11 digits
    if (nemisId.length < 11) {
      setSimulatedStudent(null);
      form.setValue("studentName", "");
      form.setValue("school", "");
      return;
    }

    // Validate format before API call
    const validation = validateNemisFormat(nemisId);
    if (!validation.isValid) {
      setLookupError(validation.error || "Invalid NEMIS ID format");
      setSimulatedStudent(null);
      return;
    }

    // Perform API lookup
    setIsLookingUp(true);
    try {
      const result: NemisLookupResult = await lookupNemisId(nemisId);
      
      if (result.success && result.data) {
        const studentData: StudentData = {
          name: result.data.studentName,
          school: result.data.schoolName,
          countyName: result.data.countyName,
          schoolCode: result.data.schoolCode,
        };
        setSimulatedStudent(studentData);
        form.setValue("studentName", result.data.studentName);
        form.setValue("school", result.data.schoolName);
        setLookupError(null);
      } else {
        setLookupError(result.error || "Student not found in NEMIS database");
        setSimulatedStudent(null);
        form.setValue("studentName", "");
        form.setValue("school", "");
      }
    } catch (error) {
      setLookupError("Failed to connect to NEMIS database. Please try again.");
      setSimulatedStudent(null);
    } finally {
      setIsLookingUp(false);
    }
  }, [form]);

  const onSubmit = (formData: SecondaryStudentFormData) => {
    updateData({
      secondaryStudent: {
        nemisId: formData.nemisId,
        studentName: formData.studentName,
        classForm: formData.classForm,
        school: formData.school,
      },
    });
    onNext();
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <School className="h-5 w-5 text-primary" />
          Secondary Student Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* NEMIS ID */}
            <FormField
              control={form.control}
              name="nemisId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NEMIS ID</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="e.g., 04710011234"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "");
                          field.onChange(value);
                          handleNemisLookup(value);
                        }}
                        maxLength={11}
                        className={cn(
                          isLookingUp && "pr-10",
                          lookupError && "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                      {isLookingUp && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormDescription>
                    Format: CCC-SSSS-NNNN (County-School-Student)
                    {field.value.length > 0 && field.value.length < 11 && (
                      <span className="ml-2 text-muted-foreground">
                        ({field.value.length}/11 digits)
                      </span>
                    )}
                    {field.value.length === 11 && (
                      <span className="ml-2 text-primary font-medium">
                        {formatNemisId(field.value)}
                      </span>
                    )}
                  </FormDescription>
                  {lookupError && (
                    <div className="flex items-center gap-2 text-sm text-destructive mt-1">
                      <AlertCircle className="h-4 w-4" />
                      <span>{lookupError}</span>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Student Name (auto-filled, masked) */}
            {simulatedStudent && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg animate-in fade-in-50 duration-300">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Student Verified via NEMIS</span>
                  <Check className="h-4 w-4 text-primary" />
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {maskName(simulatedStudent.name)}
                </p>
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <School className="h-4 w-4" />
                  <span>{simulatedStudent.school}</span>
                  <span className="text-xs">({simulatedStudent.countyName} County)</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Name masked for privacy. Full details stored securely.
                </p>
              </div>
            )}

            {/* Hidden student name field */}
            <input type="hidden" {...form.register("studentName")} />

            {/* Class/Form */}
            <FormField
              control={form.control}
              name="classForm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Class/Form</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="hover:scale-[1.02] transition-transform">
                        <SelectValue placeholder="Select your class/form" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="form1">Form 1</SelectItem>
                      <SelectItem value="form2">Form 2</SelectItem>
                      <SelectItem value="form3">Form 3</SelectItem>
                      <SelectItem value="form4">Form 4</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* School (auto-filled from NEMIS, with option to change) */}
            <FormField
              control={form.control}
              name="school"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>School</FormLabel>
                  {simulatedStudent ? (
                    <div className="p-3 bg-muted/50 border rounded-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <School className="h-4 w-4 text-primary" />
                          <span className="font-medium">{field.value}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSchoolOpen(true)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Change
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Auto-detected from NEMIS ID
                      </p>
                    </div>
                  ) : (
                    <Popover open={schoolOpen} onOpenChange={setSchoolOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={schoolOpen}
                            className={cn(
                              "w-full justify-between hover:scale-[1.02] transition-transform",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? kenyanSchools.find((school) => school === field.value) || field.value
                              : "Search for your school..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search schools..." />
                          <CommandList>
                            <CommandEmpty>No school found.</CommandEmpty>
                            <CommandGroup>
                              {kenyanSchools.map((school) => (
                                <CommandItem
                                  key={school}
                                  value={school}
                                  onSelect={() => {
                                    form.setValue("school", school);
                                    setSchoolOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === school ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {school}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                  <FormMessage />
                  
                  {/* Hidden popover for changing school when auto-filled */}
                  {simulatedStudent && (
                    <Popover open={schoolOpen} onOpenChange={setSchoolOpen}>
                      <PopoverTrigger asChild>
                        <span className="hidden" />
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search schools..." />
                          <CommandList>
                            <CommandEmpty>No school found.</CommandEmpty>
                            <CommandGroup>
                              {kenyanSchools.map((school) => (
                                <CommandItem
                                  key={school}
                                  value={school}
                                  onSelect={() => {
                                    form.setValue("school", school);
                                    setSchoolOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === school ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {school}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </FormItem>
              )}
            />

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                className="hover:scale-105 transition-transform"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              <Button 
                type="submit"
                className="hover:scale-105 transition-transform"
                disabled={!simulatedStudent}
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
