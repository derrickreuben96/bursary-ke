import { useState } from "react";
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
import { ArrowLeft, ArrowRight, Check, ChevronsUpDown, School, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { maskName } from "@/lib/maskData";

// Mock schools list
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

const secondaryStudentSchema = z.object({
  nemisId: z
    .string()
    .min(1, "NEMIS ID is required")
    .regex(/^\d{10,14}$/, "NEMIS ID must be 10-14 digits"),
  studentName: z.string().min(2, "Student name is required"),
  classForm: z.string().min(1, "Class/Form is required"),
  school: z.string().min(1, "School is required"),
});

type SecondaryStudentFormData = z.infer<typeof secondaryStudentSchema>;

interface SecondaryStudentFormProps {
  onNext: () => void;
  onBack: () => void;
}

export function SecondaryStudentForm({ onNext, onBack }: SecondaryStudentFormProps) {
  const { data, updateData } = useApplication();
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [simulatedName, setSimulatedName] = useState("");

  const form = useForm<SecondaryStudentFormData>({
    resolver: zodResolver(secondaryStudentSchema),
    defaultValues: {
      nemisId: "",
      studentName: "",
      classForm: "",
      school: "",
    },
  });

  // Simulate NEMIS ID lookup
  const handleNemisLookup = (nemisId: string) => {
    if (nemisId.length >= 10) {
      // Simulate API response with a random Kenyan name
      const sampleNames = [
        "John Kamau Mwangi",
        "Mary Wanjiku Njoroge",
        "Peter Ochieng Otieno",
        "Grace Akinyi Odhiambo",
        "David Kiprop Cheruiyot",
      ];
      const randomName = sampleNames[Math.floor(Math.random() * sampleNames.length)];
      setSimulatedName(randomName);
      form.setValue("studentName", randomName);
    } else {
      setSimulatedName("");
    }
  };

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
                    <Input
                      placeholder="Enter 10-14 digit NEMIS ID"
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "");
                        field.onChange(value);
                        handleNemisLookup(value);
                      }}
                      maxLength={14}
                    />
                  </FormControl>
                  <FormDescription>
                    Your National Education Management Information System ID
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Student Name (auto-filled, masked) */}
            {simulatedName && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Student Identified</span>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {maskName(simulatedName)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Name masked for privacy. Full name stored securely.
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

            {/* School (searchable) */}
            <FormField
              control={form.control}
              name="school"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>School</FormLabel>
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
                  <FormMessage />
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
                disabled={!simulatedName}
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
