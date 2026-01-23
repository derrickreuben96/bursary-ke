import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
import { Card } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, GraduationCap, Check, ChevronsUpDown } from "lucide-react";
import { universityStudentSchema, type UniversityStudentFormData } from "@/lib/validationSchemas";
import { kenyanInstitutions } from "@/lib/mockData";
import { maskStudentId } from "@/lib/maskData";
import { useApplication } from "@/context/ApplicationContext";
import { cn } from "@/lib/utils";

interface UniversityStudentFormProps {
  onNext: () => void;
  onBack: () => void;
}

export function UniversityStudentForm({ onNext, onBack }: UniversityStudentFormProps) {
  const { data, updateData } = useApplication();
  const [institutionOpen, setInstitutionOpen] = useState(false);

  const form = useForm<UniversityStudentFormData>({
    resolver: zodResolver(universityStudentSchema),
    defaultValues: {
      studentId: data.universityStudent?.studentId || "",
      studentName: data.universityStudent?.studentName || "",
      institution: data.universityStudent?.institution || "",
      course: data.universityStudent?.course || "",
      yearOfStudy: data.universityStudent?.yearOfStudy,
    },
  });

  const studentId = form.watch("studentId");

  const onSubmit = (formData: UniversityStudentFormData) => {
    updateData({ universityStudent: formData });
    onNext();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Info Card */}
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex gap-3">
            <GraduationCap className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">University/College Student</p>
              <p className="text-sm text-muted-foreground">
                Enter your student details exactly as they appear in your institution's records.
              </p>
            </div>
          </div>
        </Card>

        {/* Student ID */}
        <FormField
          control={form.control}
          name="studentId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Student ID Number *</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., STU/2024/12345"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {studentId.length >= 5 && (
                  <span className="text-primary">
                    Will be displayed as: {maskStudentId(studentId)}
                  </span>
                )}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Student Name */}
        <FormField
          control={form.control}
          name="studentName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name (as per institution records) *</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter your full name"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Institution */}
        <FormField
          control={form.control}
          name="institution"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Institution *</FormLabel>
              <Popover open={institutionOpen} onOpenChange={setInstitutionOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={institutionOpen}
                      className={cn(
                        "w-full justify-between h-10",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value || "Search and select your institution..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 bg-background z-50" align="start">
                  <Command className="bg-background">
                    <CommandInput placeholder="Search institution..." />
                    <CommandList>
                      <CommandEmpty>No institution found.</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-auto">
                        {kenyanInstitutions.map((institution) => (
                          <CommandItem
                            key={institution}
                            value={institution}
                            onSelect={() => {
                              form.setValue("institution", institution);
                              setInstitutionOpen(false);
                            }}
                            className="cursor-pointer"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                field.value === institution ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {institution}
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

        {/* Course */}
        <FormField
          control={form.control}
          name="course"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Course/Program *</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Bachelor of Science in Computer Science"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Year of Study */}
        <FormField
          control={form.control}
          name="yearOfStudy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Year of Study *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select year of study" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="Year 1">Year 1</SelectItem>
                  <SelectItem value="Year 2">Year 2</SelectItem>
                  <SelectItem value="Year 3">Year 3</SelectItem>
                  <SelectItem value="Year 4">Year 4</SelectItem>
                  <SelectItem value="Year 5">Year 5</SelectItem>
                  <SelectItem value="Year 6">Year 6</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-between pt-4">
          <Button type="button" variant="outline" size="lg" onClick={onBack}>
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back
          </Button>
          <Button type="submit" size="lg">
            Next: Assessment
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </form>
    </Form>
  );
}
