import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload } from "lucide-react";
interface TemplateUploadProps {
  onTemplateUpload: (file: File) => void;
  isUploaded: boolean;
}
const TemplateUpload = ({
  onTemplateUpload,
  isUploaded
}: TemplateUploadProps) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.name.endsWith('.docx') || file.name.endsWith('.doc'))) {
      onTemplateUpload(file);
    }
  };
  return (
    <Card className="shadow-xl hover:shadow-2xl transition-all duration-500 border-l-4 border-l-primary hover:border-l-primary/80 bg-gradient-to-br from-card to-muted/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-legal-header text-xl">
          <Upload className="h-6 w-6 text-primary animate-bounce-gentle" />
          Upload Template
        </CardTitle>
        <CardDescription className="text-base">
          Upload a Word document template (.docx) with placeholders
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template" className="text-base font-medium">Word Template File</Label>
            <Input
              id="template"
              type="file"
              accept=".docx,.doc"
              onChange={handleFileChange}
              className="cursor-pointer h-12 transition-all duration-200 hover:border-primary focus:border-primary hover:scale-[1.02] border-2"
            />
          </div>
          {isUploaded && (
            <div className="text-sm text-green-600 font-medium bg-green-50 dark:bg-green-950/30 p-3 rounded-lg animate-scale-in border-2 border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2">
                <span className="text-lg">✓</span>
                <span>Template uploaded successfully</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
export default TemplateUpload;